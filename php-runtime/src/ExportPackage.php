<?php
declare(strict_types=1);

namespace GK\Export;

final class ExportPackage
{
    /**
     * @param array<string,mixed> $manifest
     * @param array<string,array<string,mixed>> $documents
     */
    public function __construct(
        public readonly array $manifest,
        private readonly array $documents
    ) {
    }

    /** @return array<string,mixed> */
    public function document(string $path): array
    {
        if (!array_key_exists($path, $this->documents)) {
            throw new ExportLoadException('DOCUMENT_NOT_LOADED', "Export document is not loaded: {$path}", ['path' => $path]);
        }
        return $this->documents[$path];
    }

    /** @return mixed */
    public function data(string $path): mixed
    {
        return $this->document($path)['data'];
    }

    /** @return list<string> */
    public function paths(): array
    {
        return array_keys($this->documents);
    }

    /** @return array<string,array<string,mixed>> */
    public function allDocuments(): array
    {
        return $this->documents;
    }
}
