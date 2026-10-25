using System.Text.Json;
using MongoDB.Bson;
using MongoDB.Bson.IO;
using MongoDB.Bson.Serialization;
using MongoDB.Bson.Serialization.Serializers;

namespace NotificationService.Infrastructure.Data;

/// <summary>
/// Custom BSON serializer for <see cref="JsonElement"/> values that arrive
/// when ASP.NET Core deserializes JSON into <c>Dictionary&lt;string, object&gt;</c>.
/// Converts each JsonElement into its BSON equivalent.
/// </summary>
public class JsonElementBsonSerializer : SerializerBase<JsonElement>
{
    public override void Serialize(BsonSerializationContext context, BsonSerializationArgs args, JsonElement value)
    {
        var writer = context.Writer;

        switch (value.ValueKind)
        {
            case JsonValueKind.Object:
                writer.WriteStartDocument();
                foreach (var property in value.EnumerateObject())
                {
                    writer.WriteName(property.Name);
                    Serialize(context, args, property.Value);
                }
                writer.WriteEndDocument();
                break;

            case JsonValueKind.Array:
                writer.WriteStartArray();
                foreach (var item in value.EnumerateArray())
                {
                    Serialize(context, args, item);
                }
                writer.WriteEndArray();
                break;

            case JsonValueKind.String:
                writer.WriteString(value.GetString()!);
                break;

            case JsonValueKind.Number:
                if (value.TryGetInt32(out var intVal))
                    writer.WriteInt32(intVal);
                else if (value.TryGetInt64(out var longVal))
                    writer.WriteInt64(longVal);
                else
                    writer.WriteDouble(value.GetDouble());
                break;

            case JsonValueKind.True:
                writer.WriteBoolean(true);
                break;

            case JsonValueKind.False:
                writer.WriteBoolean(false);
                break;

            case JsonValueKind.Null:
            case JsonValueKind.Undefined:
            default:
                writer.WriteNull();
                break;
        }
    }

    public override JsonElement Deserialize(BsonDeserializationContext context, BsonDeserializationArgs args)
    {
        var reader = context.Reader;
        var bsonType = reader.GetCurrentBsonType();

        // Convert BSON back to a JsonElement via a JSON string round-trip
        var jsonString = bsonType switch
        {
            BsonType.String => JsonSerializer.SerializeToElement(reader.ReadString()),
            BsonType.Int32 => JsonSerializer.SerializeToElement(reader.ReadInt32()),
            BsonType.Int64 => JsonSerializer.SerializeToElement(reader.ReadInt64()),
            BsonType.Double => JsonSerializer.SerializeToElement(reader.ReadDouble()),
            BsonType.Boolean => JsonSerializer.SerializeToElement(reader.ReadBoolean()),
            BsonType.Null => NullJsonElement(reader),
            BsonType.Document => DeserializeDocument(context),
            BsonType.Array => DeserializeArray(context),
            _ => SkipAndReturnDefault(reader)
        };

        return jsonString;
    }

    private static JsonElement NullJsonElement(IBsonReader reader)
    {
        reader.ReadNull();
        return default;
    }

    private static JsonElement SkipAndReturnDefault(IBsonReader reader)
    {
        reader.SkipValue();
        return default;
    }

    private JsonElement DeserializeDocument(BsonDeserializationContext context)
    {
        var reader = context.Reader;
        var dict = new Dictionary<string, object?>();

        reader.ReadStartDocument();
        while (reader.ReadBsonType() != BsonType.EndOfDocument)
        {
            var name = reader.ReadName();
            var element = Deserialize(context, new BsonDeserializationArgs());
            dict[name] = element.ValueKind == JsonValueKind.Undefined ? null : element;
        }
        reader.ReadEndDocument();

        return JsonSerializer.SerializeToElement(dict);
    }

    private JsonElement DeserializeArray(BsonDeserializationContext context)
    {
        var reader = context.Reader;
        var list = new List<object?>();

        reader.ReadStartArray();
        while (reader.ReadBsonType() != BsonType.EndOfDocument)
        {
            var element = Deserialize(context, new BsonDeserializationArgs());
            list.Add(element.ValueKind == JsonValueKind.Undefined ? null : element);
        }
        reader.ReadEndArray();

        return JsonSerializer.SerializeToElement(list);
    }
}
