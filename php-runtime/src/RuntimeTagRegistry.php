<?php
declare(strict_types=1);

namespace GK\Export;

/**
 * Read-only runtime index for GK STUDIO tag data.
 * Parent/child relations are management metadata only; no gameplay inheritance is applied.
 */
final class RuntimeTagRegistry
{
    /** @var array<string,array<string,mixed>> */
    private array $categoriesById = [];
    /** @var array<string,array<string,mixed>> */
    private array $tagsById = [];
    /** @var array<string,string> */
    private array $lookup = [];
    /** @var array<string,list<string>> */
    private array $childrenById = [];

    /**
     * @param list<array<string,mixed>> $categories
     * @param list<array<string,mixed>> $tags
     */
    public function __construct(array $categories, array $tags)
    {
        foreach ($categories as $index => $category) {
            $id = self::requiredString($category, 'id', "tag_categories[{$index}]");
            self::requiredString($category, 'name', "tag_categories[{$index}]");
            if (isset($this->categoriesById[$id])) {
                throw new ExportLoadException('TAG_CATEGORY_DUPLICATE_ID', "Duplicate tag category ID: {$id}", ['id' => $id, 'index' => $index]);
            }
            $this->categoriesById[$id] = $category;
        }

        foreach ($tags as $index => $tag) {
            $id = self::requiredString($tag, 'id', "tags[{$index}]");
            self::requiredString($tag, 'name', "tags[{$index}]");
            if (isset($this->tagsById[$id])) {
                throw new ExportLoadException('TAG_DUPLICATE_ID', "Duplicate tag ID: {$id}", ['id' => $id, 'index' => $index]);
            }
            $aliases = $tag['aliases'] ?? [];
            if (!is_array($aliases) || !array_is_list($aliases)) {
                throw new ExportLoadException('TAG_ALIASES_INVALID', "Tag aliases must be an array: {$id}", ['id' => $id]);
            }
            foreach ($aliases as $aliasIndex => $alias) {
                if (!is_string($alias) || trim($alias) === '') {
                    throw new ExportLoadException('TAG_ALIAS_INVALID', "Tag alias must be a non-empty string: {$id}", ['id' => $id, 'alias_index' => $aliasIndex]);
                }
            }
            $this->tagsById[$id] = $tag;
        }

        $this->validateReferences();
        $this->validateParentCycles();
        $this->buildIndexes();
    }

    /** @param array<string,mixed> $project */
    public static function fromStudioProject(array $project): self
    {
        $categories = $project['tag_categories'] ?? [];
        $tags = $project['tags'] ?? [];
        if (!is_array($categories) || !array_is_list($categories)) {
            throw new ExportLoadException('TAG_CATEGORIES_INVALID', 'tag_categories must be an array.');
        }
        if (!is_array($tags) || !array_is_list($tags)) {
            throw new ExportLoadException('TAGS_INVALID', 'tags must be an array.');
        }
        return new self($categories, $tags);
    }

    public function has(string $id): bool { return isset($this->tagsById[$id]); }

    /** @return array<string,mixed>|null */
    public function find(string $id): ?array { return $this->tagsById[$id] ?? null; }

    /** @return array<string,mixed> */
    public function require(string $id): array
    {
        $tag = $this->find($id);
        if ($tag === null) {
            throw new ExportLoadException('TAG_NOT_FOUND', "Tag was not found: {$id}", ['id' => $id]);
        }
        return $tag;
    }

    /** Resolve exact ID, name, or alias. Returns null when unresolved. */
    public function resolveId(string $value): ?string
    {
        if (isset($this->tagsById[$value])) { return $value; }
        $key = self::lookupKey($value);
        return $key === '' ? null : ($this->lookup[$key] ?? null);
    }

    /** @return array<string,mixed>|null */
    public function category(string $id): ?array { return $this->categoriesById[$id] ?? null; }

    /** @return list<string> */
    public function children(string $id): array { return $this->childrenById[$id] ?? []; }

    /** @return list<array<string,mixed>> */
    public function tags(): array { return array_values($this->tagsById); }

    /** @return list<array<string,mixed>> */
    public function categories(): array { return array_values($this->categoriesById); }

    public function isDeprecated(string $id): bool { return ($this->require($id)['deprecated'] ?? false) === true; }

    public function replacementId(string $id): ?string
    {
        $replacement = $this->require($id)['replacement_tag_id'] ?? '';
        return is_string($replacement) && $replacement !== '' ? $replacement : null;
    }

    private function validateReferences(): void
    {
        foreach ($this->tagsById as $id => $tag) {
            $categoryId = $tag['category_id'] ?? '';
            if (!is_string($categoryId)) {
                throw new ExportLoadException('TAG_CATEGORY_REFERENCE_INVALID', "category_id must be a string: {$id}", ['id' => $id]);
            }
            if ($categoryId !== '' && !isset($this->categoriesById[$categoryId])) {
                throw new ExportLoadException('TAG_CATEGORY_NOT_FOUND', "Tag category was not found: {$categoryId}", ['id' => $id, 'category_id' => $categoryId]);
            }

            foreach (['parent_id' => 'TAG_PARENT_NOT_FOUND', 'replacement_tag_id' => 'TAG_REPLACEMENT_NOT_FOUND'] as $field => $code) {
                $reference = $tag[$field] ?? '';
                if (!is_string($reference)) {
                    throw new ExportLoadException('TAG_REFERENCE_INVALID', "{$field} must be a string: {$id}", ['id' => $id, 'field' => $field]);
                }
                if ($reference !== '' && !isset($this->tagsById[$reference])) {
                    throw new ExportLoadException($code, "Referenced tag was not found: {$reference}", ['id' => $id, 'field' => $field, 'reference_id' => $reference]);
                }
                if ($reference !== '' && $reference === $id) {
                    throw new ExportLoadException('TAG_SELF_REFERENCE', "Tag cannot reference itself: {$id}", ['id' => $id, 'field' => $field]);
                }
            }
        }
    }

    private function validateParentCycles(): void
    {
        foreach (array_keys($this->tagsById) as $start) {
            $seen = [];
            $current = $start;
            while ($current !== '') {
                if (isset($seen[$current])) {
                    throw new ExportLoadException('TAG_PARENT_CYCLE', "Tag parent cycle detected at: {$current}", ['start_id' => $start, 'cycle_id' => $current]);
                }
                $seen[$current] = true;
                $parent = $this->tagsById[$current]['parent_id'] ?? '';
                $current = is_string($parent) ? $parent : '';
            }
        }
    }

    private function buildIndexes(): void
    {
        foreach ($this->tagsById as $id => $tag) {
            foreach ([$tag['name'] ?? '', ...($tag['aliases'] ?? [])] as $term) {
                if (!is_string($term)) { continue; }
                $key = self::lookupKey($term);
                if ($key !== '' && !isset($this->lookup[$key])) {
                    $this->lookup[$key] = $id;
                }
            }
            $parent = $tag['parent_id'] ?? '';
            if (is_string($parent) && $parent !== '') {
                $this->childrenById[$parent] ??= [];
                $this->childrenById[$parent][] = $id;
            }
        }
    }

    /** @param array<string,mixed> $record */
    private static function requiredString(array $record, string $field, string $path): string
    {
        $value = $record[$field] ?? null;
        if (!is_string($value) || trim($value) === '') {
            throw new ExportLoadException('TAG_DATA_INVALID', "{$path}.{$field} must be a non-empty string.", ['path' => $path, 'field' => $field]);
        }
        return $value;
    }

    private static function lookupKey(string $value): string
    {
        $value = trim($value);
        return function_exists('mb_strtolower') ? mb_strtolower($value, 'UTF-8') : strtolower($value);
    }
}
