public static class ImageValidation
{
    public static bool TryDetect(ReadOnlySpan<byte> bytes, out string mediaType)
    {
        if (bytes.Length >= 3 && bytes[0] == 0xff && bytes[1] == 0xd8 && bytes[2] == 0xff)
        {
            mediaType = "image/jpeg";
            return true;
        }

        if (bytes.Length >= 12 && bytes[..4].SequenceEqual("RIFF"u8) &&
            bytes.Slice(8, 4).SequenceEqual("WEBP"u8))
        {
            mediaType = "image/webp";
            return true;
        }

        mediaType = string.Empty;
        return false;
    }
}
