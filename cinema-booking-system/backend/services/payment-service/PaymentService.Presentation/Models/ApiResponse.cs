namespace PaymentService.Presentation.Models;

public class ApiResponse<T>
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public T? Data { get; set; }

    public static ApiResponse<T> Ok(T data, string message = "Success") => new()
    {
        Success = true,
        Message = message,
        Data = data
    };

    public static ApiResponse<T> Error(string message, T? data = default) => new()
    {
        Success = false,
        Message = message,
        Data = data
    };
}
