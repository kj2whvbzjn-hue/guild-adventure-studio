<?php
declare(strict_types=1);

namespace GK\Export;

/** Validates tag ID arrays anywhere in GK STUDIO project data. */
final class RuntimeTagReferenceValidator
{
    /**
     * @param array<string,mixed> $project
     * @return list<array{code:string,path:string,tag_id:string}>
     */
    public function validate(array $project, RuntimeTagRegistry $registry): array
    {
        $issues = [];
        $this->scan($project, '$', $registry, $issues);
        return $issues;
    }

    /**
     * @param array<string,mixed>|list<mixed> $node
     * @param list<array{code:string,path:string,tag_id:string}> $issues
     */
    private function scan(array $node, string $path, RuntimeTagRegistry $registry, array &$issues): void
    {
        foreach ($node as $key => $value) {
            $childPath = $path . (is_int($key) ? "[{$key}]" : '.' . $key);
            if ($key === 'tags' && is_array($value) && array_is_list($value)) {
                foreach ($value as $index => $tagId) {
                    if (is_string($tagId) && $tagId !== '' && !$registry->has($tagId)) {
                        $issues[] = ['code' => 'UNKNOWN_TAG_REFERENCE', 'path' => $childPath . "[{$index}]", 'tag_id' => $tagId];
                    }
                }
                continue;
            }
            if (is_array($value)) {
                $this->scan($value, $childPath, $registry, $issues);
            }
        }
    }
}
