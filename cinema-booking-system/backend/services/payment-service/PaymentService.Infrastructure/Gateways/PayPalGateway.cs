using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using PaymentService.Application.Contracts;
using PaymentService.Application.DTOs;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace PaymentService.Infrastructure.Gateways;

/// <summary>
/// PayPal Orders API v2 gateway (Sandbox mode).
/// Uses direct REST API calls instead of the legacy PayPalCheckoutSdk 
/// for full .NET 9 compatibility.
/// Sandbox signup: https://developer.paypal.com
/// </summary>
public class PayPalGateway : IPaymentGateway
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<PayPalGateway> _logger;
    private readonly HttpClient _httpClient;

    // PayPal Sandbox base URL
    private const string SANDBOX_BASE_URL = "https://api-m.sandbox.paypal.com";
    private const string PRODUCTION_BASE_URL = "https://api-m.paypal.com";

    public PayPalGateway(
        IConfiguration configuration,
        ILogger<PayPalGateway> logger,
        IHttpClientFactory httpClientFactory)
    {
        _configuration = configuration;
        _logger = logger;
        _httpClient = httpClientFactory.CreateClient("PayPal");
    }

    public async Task<PaymentInitiationResult> InitiateAsync(PaymentRequest request)
    {
        try
        {
            var accessToken = await GetAccessTokenAsync();

            var baseUrl = GetBaseUrl();
            var orderRequest = new
            {
                intent = "CAPTURE",
                purchase_units = new[]
                {
                    new
                    {
                        reference_id = request.PaymentId.ToString(),
                        amount = new
                        {
                            currency_code = NormalizeCurrency(request.Currency),
                            value = FormatAmount(request.Amount, request.Currency)
                        },
                        description = "Cinema Ticket Booking"
                    }
                },
                payment_source = new
                {
                    paypal = new
                    {
                        experience_context = new
                        {
                            payment_method_preference = "IMMEDIATE_PAYMENT_REQUIRED",
                            brand_name = "Cinema Booking System",
                            locale = "en-US",
                            landing_page = "LOGIN",
                            user_action = "PAY_NOW",
                            return_url = request.SuccessUrl,
                            cancel_url = request.CancelUrl
                        }
                    }
                }
            };

            var requestMessage = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/v2/checkout/orders");
            requestMessage.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            requestMessage.Content = new StringContent(
                JsonSerializer.Serialize(orderRequest),
                Encoding.UTF8,
                "application/json");

            var response = await _httpClient.SendAsync(requestMessage);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("PayPal order creation failed. Status: {Status}, Body: {Body}",
                    response.StatusCode, responseBody);
                return new PaymentInitiationResult(false, null, $"PayPal error: {response.StatusCode}");
            }

            var doc = JsonDocument.Parse(responseBody);
            var orderId = doc.RootElement.GetProperty("id").GetString();

            // Find the approval URL in links array
            string? approvalUrl = null;
            if (doc.RootElement.TryGetProperty("links", out var links))
            {
                foreach (var link in links.EnumerateArray())
                {
                    if (link.TryGetProperty("rel", out var rel) && rel.GetString() == "payer-action")
                    {
                        approvalUrl = link.GetProperty("href").GetString();
                        break;
                    }
                }
            }

            if (approvalUrl == null)
            {
                _logger.LogError("PayPal response missing payer-action link. OrderId: {OrderId}", orderId);
                return new PaymentInitiationResult(false, null, "PayPal approval URL not found");
            }

            _logger.LogInformation("PayPal Order created: {OrderId} for PaymentId: {PaymentId}",
                orderId, request.PaymentId);

            return new PaymentInitiationResult(true, approvalUrl, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error initiating PayPal payment for PaymentId: {PaymentId}", request.PaymentId);
            return new PaymentInitiationResult(false, null, ex.Message);
        }
    }

    public async Task<PaymentVerificationResult> VerifyCallbackAsync(IDictionary<string, string> parameters)
    {
        // PayPal redirects to return_url with ?token=ORDER_ID&PayerID=...
        if (!parameters.TryGetValue("token", out var paypalOrderId) || string.IsNullOrEmpty(paypalOrderId))
        {
            return new PaymentVerificationResult(false, null, null, "PayPal token (Order ID) is missing");
        }

        try
        {
            var accessToken = await GetAccessTokenAsync();
            var baseUrl = GetBaseUrl();

            // Capture the PayPal Order
            var captureRequest = new HttpRequestMessage(
                HttpMethod.Post,
                $"{baseUrl}/v2/checkout/orders/{paypalOrderId}/capture");
            captureRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            captureRequest.Content = new StringContent("{}", Encoding.UTF8, "application/json");

            var response = await _httpClient.SendAsync(captureRequest);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("PayPal capture failed. Status: {Status}, Body: {Body}",
                    response.StatusCode, responseBody);
                return new PaymentVerificationResult(false, null, responseBody, $"Capture failed: {response.StatusCode}");
            }

            var doc = JsonDocument.Parse(responseBody);
            var status = doc.RootElement.GetProperty("status").GetString();

            if (status != "COMPLETED")
            {
                return new PaymentVerificationResult(false, null, responseBody, $"PayPal order status: {status}");
            }

            // Extract capture ID as our TransactionId
            string? captureId = null;
            if (doc.RootElement.TryGetProperty("purchase_units", out var purchaseUnits))
            {
                var firstUnit = purchaseUnits.EnumerateArray().FirstOrDefault();
                if (firstUnit.ValueKind != JsonValueKind.Undefined &&
                    firstUnit.TryGetProperty("payments", out var payments) &&
                    payments.TryGetProperty("captures", out var captures))
                {
                    var firstCapture = captures.EnumerateArray().FirstOrDefault();
                    if (firstCapture.ValueKind != JsonValueKind.Undefined)
                        captureId = firstCapture.GetProperty("id").GetString();
                }
            }

            // Extract paymentId from reference_id (set during InitiateAsync)
            string? paymentId = null;
            if (doc.RootElement.TryGetProperty("purchase_units", out var units))
            {
                var firstUnit = units.EnumerateArray().FirstOrDefault();
                if (firstUnit.ValueKind != JsonValueKind.Undefined &&
                    firstUnit.TryGetProperty("reference_id", out var refId))
                {
                    paymentId = refId.GetString();
                }
            }

            if (!string.IsNullOrEmpty(paymentId))
                parameters["paymentId"] = paymentId;

            _logger.LogInformation("PayPal Order {OrderId} captured. CaptureId: {CaptureId}", paypalOrderId, captureId);

            return new PaymentVerificationResult(true, captureId, responseBody, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error verifying PayPal callback for order: {OrderId}", paypalOrderId);
            return new PaymentVerificationResult(false, null, null, ex.Message);
        }
    }

    private async Task<string> GetAccessTokenAsync()
    {
        var clientId = _configuration["PayPal:ClientId"]
            ?? throw new InvalidOperationException("PayPal:ClientId is not configured.");
        var clientSecret = _configuration["PayPal:ClientSecret"]
            ?? throw new InvalidOperationException("PayPal:ClientSecret is not configured.");

        var credentials = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{clientId}:{clientSecret}"));
        var baseUrl = GetBaseUrl();

        var tokenRequest = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/v1/oauth2/token");
        tokenRequest.Headers.Authorization = new AuthenticationHeaderValue("Basic", credentials);
        tokenRequest.Content = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("grant_type", "client_credentials")
        });

        var response = await _httpClient.SendAsync(tokenRequest);
        var body = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"PayPal token request failed: {response.StatusCode} — {body}");

        var doc = JsonDocument.Parse(body);
        return doc.RootElement.GetProperty("access_token").GetString()
            ?? throw new InvalidOperationException("PayPal access_token is null");
    }

    private string GetBaseUrl()
    {
        var mode = _configuration["PayPal:Mode"] ?? "sandbox";
        return mode.Equals("production", StringComparison.OrdinalIgnoreCase)
            ? PRODUCTION_BASE_URL
            : SANDBOX_BASE_URL;
    }

    /// <summary>
    /// PayPal does not support VND directly in sandbox (only a limited set of currencies).
    /// Default to USD for test purposes.
    /// </summary>
    private static string NormalizeCurrency(string currency)
        => currency.Equals("VND", StringComparison.OrdinalIgnoreCase) ? "USD" : currency.ToUpper();

    /// <summary>
    /// PayPal requires decimal format (e.g. "45.00"). VND amounts are divided by 25000 to USD for test.
    /// </summary>
    private static string FormatAmount(decimal amount, string currency)
    {
        if (currency.Equals("VND", StringComparison.OrdinalIgnoreCase))
        {
            // Approximate VND → USD for sandbox test (no real money)
            var usd = amount / 25000m;
            return usd.ToString("F2");
        }
        return amount.ToString("F2");
    }
}
