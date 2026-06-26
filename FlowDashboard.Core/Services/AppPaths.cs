namespace FlowDashboard.Core.Services;

public static class AppPaths
{
    public static bool ProductMode => IsTruthy(Environment.GetEnvironmentVariable("FLOWDASHBOARD_PRODUCT_MODE"));
    public static string BaseDir => ResolveBaseDir();
    public static string ResourceDir => ResolveResourceDir();
    public static string DataDir => ResolveDataDir();

    private static bool IsTruthy(string? value)
    {
        return value != null && new[] { "1", "true", "yes", "on" }.Contains(value.Trim().ToLowerInvariant());
    }

    private static string ResolveBaseDir()
    {
        var env = Environment.GetEnvironmentVariable("FLOWDASHBOARD_BASE_DIR");
        if (!string.IsNullOrWhiteSpace(env)) return Path.GetFullPath(env);

        var candidates = new[]
        {
            Directory.GetCurrentDirectory(),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..")),
            AppContext.BaseDirectory
        };

        foreach (var candidate in candidates)
        {
            if (File.Exists(Path.Combine(candidate, "local_adb_server.py")) || Directory.Exists(Path.Combine(candidate, "electron-app")))
            {
                return candidate;
            }
        }

        return Directory.GetCurrentDirectory();
    }

    private static string ResolveResourceDir()
    {
        var env = Environment.GetEnvironmentVariable("FLOWDASHBOARD_RESOURCE_DIR");
        return Path.GetFullPath(string.IsNullOrWhiteSpace(env) ? BaseDir : env);
    }

    private static string ResolveDataDir()
    {
        var env = Environment.GetEnvironmentVariable("FLOWDASHBOARD_DATA_DIR");
        string dataDir;
        if (!string.IsNullOrWhiteSpace(env))
        {
            dataDir = Path.GetFullPath(env);
        }
        else if (ProductMode)
        {
            var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            dataDir = Path.Combine(localAppData, "FlowDashboard");
        }
        else
        {
            dataDir = BaseDir;
        }
        Directory.CreateDirectory(dataDir);
        return dataDir;
    }

    public static string DataFile(string fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName)) throw new ArgumentException("fileName required", nameof(fileName));
        if (Path.IsPathRooted(fileName) || fileName.Contains("..") || fileName.Contains(Path.DirectorySeparatorChar) || fileName.Contains(Path.AltDirectorySeparatorChar))
        {
            throw new ArgumentException("Invalid data file name", nameof(fileName));
        }
        return Path.Combine(DataDir, fileName);
    }

    public static void MigrateFileIfMissing(string oldPath, string newPath)
    {
        if (string.Equals(Path.GetFullPath(oldPath), Path.GetFullPath(newPath), StringComparison.OrdinalIgnoreCase)) return;
        if (!File.Exists(oldPath) || File.Exists(newPath)) return;
        Directory.CreateDirectory(Path.GetDirectoryName(newPath) ?? DataDir);
        File.Copy(oldPath, newPath, overwrite: false);
    }

    public static void AtomicWriteText(string path, string content)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path) ?? DataDir);
        var temp = $"{path}.{Environment.ProcessId}.{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}.tmp";
        var backup = $"{path}.bak";
        using (var stream = new FileStream(temp, FileMode.CreateNew, FileAccess.Write, FileShare.None))
        using (var writer = new StreamWriter(stream))
        {
            writer.Write(content);
            writer.Flush();
            stream.Flush(flushToDisk: true);
        }
        if (File.Exists(path))
        {
            File.Copy(path, backup, overwrite: true);
        }
        File.Move(temp, path, overwrite: true);
    }
}
