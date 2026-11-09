package main

import (
	"archive/zip"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

type ArchiveEntry struct {
	sourcePath  string
	archivePath string
}

type PackOptions struct {
	version       string
	useManifestV3 bool
}

func newArchiveEntry(sourcePath, archivePath string) ArchiveEntry {
	return ArchiveEntry{
		sourcePath:  sourcePath,
		archivePath: filepath.ToSlash(archivePath),
	}
}

func buildExtensionEntries(options PackOptions) []ArchiveEntry {
	entries := []ArchiveEntry{
		newArchiveEntry(filepath.Join("icons", "pickpocket.png"), "icons/pickpocket.png"),
		newArchiveEntry("background.js", "background.js"),
		newArchiveEntry("content.js", "content.js"),
		newArchiveEntry("picker.css", "picker.css"),
		newArchiveEntry("picker.html", "picker.html"),
		newArchiveEntry("picker.js", "picker.js"),
	}

	if options.useManifestV3 {
		entries = append(entries, newArchiveEntry("manifest_v3.json", "manifest.json"))
	} else {
		entries = append(entries, newArchiveEntry("manifest.json", "manifest.json"))
	}
	return entries
}

func parseArgs(args []string) (PackOptions, error) {
	var options PackOptions
	versionFound := false

	for _, arg := range args {
		if arg == "-mv3" || arg == "--manifest-version-3" {
			options.useManifestV3 = true
			continue
		}
		if strings.HasPrefix(arg, "-") {
			return PackOptions{}, fmt.Errorf("unknown option %q", arg)
		}
		if versionFound {
			return PackOptions{}, errors.New("version specified more than once")
		}
		options.version = arg
		versionFound = true
	}

	if !versionFound {
		return PackOptions{}, errors.New("version is required")
	}
	if strings.ContainsAny(options.version, `/\`) {
		return PackOptions{}, errors.New("version must not contain path separators")
	}
	return options, nil
}

func buildOutputPath(options PackOptions) string {
	if options.useManifestV3 {
		return fmt.Sprintf("PocketPicker-v%s-mv3.zip", options.version)
	}
	return fmt.Sprintf("PocketPicker-v%s.zip", options.version)
}

func addFile(writer *zip.Writer, entry ArchiveEntry) (err error) {
	file, err := os.Open(entry.sourcePath)
	if err != nil {
		return fmt.Errorf("open source %q: %w", entry.sourcePath, err)
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		return fmt.Errorf("stat source %q: %w", entry.sourcePath, err)
	}
	header, err := zip.FileInfoHeader(info)
	if err != nil {
		return fmt.Errorf("build header for %q: %w", entry.sourcePath, err)
	}
	header.Name = entry.archivePath
	header.Method = zip.Deflate

	destination, err := writer.CreateHeader(header)
	if err != nil {
		return fmt.Errorf("create archive entry %q: %w", entry.archivePath, err)
	}
	_, err = io.Copy(destination, file)
	if err != nil {
		return fmt.Errorf("copy %q into archive entry %q: %w", entry.sourcePath, entry.archivePath, err)
	}
	return nil
}

func createArchive(targetPath string, entries []ArchiveEntry) (err error) {
	file, err := os.Create(targetPath)
	if err != nil {
		return fmt.Errorf("create archive %q: %w", targetPath, err)
	}

	// Remove the partial archive if writing fails.
	keepArchive := false
	defer func() {
		closeErr := file.Close()
		if !keepArchive {
			removeErr := os.Remove(targetPath)
			if removeErr != nil {
				err = fmt.Errorf("%w; remove partial archive %q: %v", err, targetPath, removeErr)
			}
			return
		}
		if closeErr != nil && err == nil {
			err = fmt.Errorf("close archive %q: %w", targetPath, closeErr)
		}
	}()

	writer := zip.NewWriter(file)
	for _, entry := range entries {
		addErr := addFile(writer, entry)
		if addErr != nil {
			return fmt.Errorf("add %q: %w", entry.archivePath, addErr)
		}
	}

	closeErr := writer.Close()
	if closeErr != nil {
		return fmt.Errorf("finalize archive %q: %w", targetPath, closeErr)
	}

	keepArchive = true
	return nil
}

func printUsage(writer io.Writer) {
	fmt.Fprintln(writer, "Usage: pack <version> [-mv3]")
	fmt.Fprintln(writer, "  -mv3  Pack with manifest V3 (optional, defaults to V2)")
}

func main() {
	options, err := parseArgs(os.Args[1:])
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		printUsage(os.Stderr)
		os.Exit(2)
	}

	targetPath := buildOutputPath(options)
	err = createArchive(targetPath, buildExtensionEntries(options))
	if err != nil {
		fmt.Fprintln(os.Stderr, "pack:", err)
		os.Exit(1)
	}

	fmt.Printf("Created: %s\n", targetPath)
}
