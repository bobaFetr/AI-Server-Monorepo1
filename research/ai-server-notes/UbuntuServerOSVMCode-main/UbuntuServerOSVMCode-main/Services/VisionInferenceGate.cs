public sealed class VisionInferenceGate : IDisposable
{
    private readonly SemaphoreSlim semaphore;

    public VisionInferenceGate(IConfiguration configuration)
    {
        var concurrency = Math.Clamp(configuration.GetValue("Vision:MaxConcurrentRequests", 2), 1, 16);
        semaphore = new SemaphoreSlim(concurrency, concurrency);
    }

    public bool TryEnter(out IDisposable? lease)
    {
        if (!semaphore.Wait(0)) { lease = null; return false; }
        lease = new Lease(semaphore);
        return true;
    }

    public void Dispose() => semaphore.Dispose();

    private sealed class Lease(SemaphoreSlim semaphore) : IDisposable
    {
        private int disposed;
        public void Dispose()
        {
            if (Interlocked.Exchange(ref disposed, 1) == 0) semaphore.Release();
        }
    }
}
