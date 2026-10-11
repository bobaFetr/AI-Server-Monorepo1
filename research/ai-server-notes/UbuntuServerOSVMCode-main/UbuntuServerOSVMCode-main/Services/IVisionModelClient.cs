public interface IVisionModelClient
{
    Task<string> DescribeAsync(
        ReadOnlyMemory<byte> image,
        string prompt,
        string mediaType,
        CancellationToken cancellationToken);
}
