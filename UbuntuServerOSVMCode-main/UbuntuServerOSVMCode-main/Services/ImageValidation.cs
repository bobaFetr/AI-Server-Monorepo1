using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Webp;

public sealed record ValidatedImage(byte[] Bytes, string MediaType, int Width, int Height);

public static class ImageValidation
{
    public static bool TryDecodeAndSanitize(
        ReadOnlySpan<byte> bytes,
        int maxWidth,
        int maxHeight,
        out ValidatedImage? validated,
        out string error)
    {
        validated = null;
        error = string.Empty;
        try
        {
            var info = Image.Identify(bytes);
            if (info is null) { error = "Image data could not be decoded."; return false; }
            if (info.Width <= 0 || info.Height <= 0 || info.Width > maxWidth || info.Height > maxHeight)
            {
                error = $"Image dimensions must not exceed {maxWidth}x{maxHeight}.";
                return false;
            }

            var format = info.Metadata.DecodedImageFormat;
            if (format is null) { error = "Image format could not be identified."; return false; }
            using var image = Image.Load(bytes);
            image.Metadata.ExifProfile = null;
            image.Metadata.IccProfile = null;
            image.Metadata.XmpProfile = null;
            using var output = new MemoryStream();
            string mediaType;
            if (format.Name.Equals("JPEG", StringComparison.OrdinalIgnoreCase))
            {
                image.Save(output, new JpegEncoder { Quality = 88 });
                mediaType = "image/jpeg";
            }
            else if (format.Name.Equals("WEBP", StringComparison.OrdinalIgnoreCase))
            {
                image.Save(output, new WebpEncoder { Quality = 88 });
                mediaType = "image/webp";
            }
            else { error = "Only JPEG and WebP images are accepted."; return false; }

            validated = new ValidatedImage(output.ToArray(), mediaType, image.Width, image.Height);
            return true;
        }
        catch (UnknownImageFormatException) { error = "Only valid JPEG and WebP images are accepted."; return false; }
        catch (InvalidImageContentException) { error = "Image data is malformed or incomplete."; return false; }
        catch (NotSupportedException) { error = "The image encoding is not supported."; return false; }
    }
}
