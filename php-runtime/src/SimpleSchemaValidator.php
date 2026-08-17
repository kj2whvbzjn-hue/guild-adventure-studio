<?php
declare(strict_types=1);

namespace GK\Export;

final class SimpleSchemaValidator
{
    public function validate(mixed $value, array $schema, string $path = '$'): void
    {
        $typeSpec = $schema['type'] ?? null;
        if ($typeSpec !== null) {
            $this->assertType($value, $typeSpec, $path);
        }

        if (is_string($value)) {
            $length = preg_match_all('/./us', $value, $matches) ? count($matches[0]) : 0;
            if (isset($schema['minLength']) && $length < (int) $schema['minLength']) {
                $this->fail($path, 'minLength');
            }
            if (isset($schema['enum']) && !in_array($value, $schema['enum'], true)) {
                $this->fail($path, 'enum');
            }
        }

        if (is_int($value) || is_float($value)) {
            if (isset($schema['minimum']) && $value < $schema['minimum']) {
                $this->fail($path, 'minimum');
            }
            if (isset($schema['maximum']) && $value > $schema['maximum']) {
                $this->fail($path, 'maximum');
            }
        }

        if (!is_array($value)) {
            return;
        }

        $isList = array_is_list($value);
        $allowsArray = $typeSpec === null ? $isList : $this->typeSpecAllows($typeSpec, 'array');
        $allowsObject = $typeSpec === null
            ? ($value === [] || !$isList)
            : $this->typeSpecAllows($typeSpec, 'object');

        if ($isList && $allowsArray) {
            if (isset($schema['items']) && is_array($schema['items'])) {
                foreach ($value as $index => $item) {
                    $this->validate($item, $schema['items'], $path . '[' . $index . ']');
                }
            }
            if (
                ($schema['uniqueItems'] ?? false) === true
                && count($value) !== count(array_unique(array_map('serialize', $value)))
            ) {
                $this->fail($path, 'uniqueItems');
            }
        }

        if (($value === [] || !$isList) && $allowsObject) {
            $required = $schema['required'] ?? [];
            foreach ($required as $key) {
                if (!array_key_exists($key, $value)) {
                    $this->fail($path . '.' . $key, 'required');
                }
            }

            $properties = $schema['properties'] ?? [];
            foreach ($properties as $key => $propertySchema) {
                if (array_key_exists($key, $value) && is_array($propertySchema)) {
                    $this->validate($value[$key], $propertySchema, $path . '.' . $key);
                }
            }

            if (($schema['additionalProperties'] ?? true) === false) {
                $extra = array_diff(array_keys($value), array_keys($properties));
                if ($extra) {
                    $this->fail($path, 'additionalProperties');
                }
            }
        }
    }

    private function assertType(mixed $value, mixed $typeSpec, string $path): void
    {
        if (is_string($typeSpec)) {
            if (!$this->matchesType($value, $typeSpec)) {
                $this->fail($path, 'type ' . $typeSpec);
            }
            return;
        }

        if (is_array($typeSpec) && $typeSpec !== []) {
            foreach ($typeSpec as $type) {
                if (is_string($type) && $this->matchesType($value, $type)) {
                    return;
                }
            }

            $labels = array_values(array_filter($typeSpec, 'is_string'));
            $this->fail($path, 'type ' . implode('|', $labels));
        }

        $this->fail($path, 'type');
    }

    private function typeSpecAllows(mixed $typeSpec, string $type): bool
    {
        if (is_string($typeSpec)) {
            return $typeSpec === $type;
        }
        return is_array($typeSpec) && in_array($type, $typeSpec, true);
    }

    private function matchesType(mixed $value, string $type): bool
    {
        return match ($type) {
            'array' => is_array($value) && array_is_list($value),
            'object' => is_array($value) && ($value === [] || !array_is_list($value)),
            'string' => is_string($value),
            'integer' => is_int($value),
            'number' => is_int($value) || is_float($value),
            'boolean' => is_bool($value),
            'null' => $value === null,
            default => false,
        };
    }

    private function fail(string $path, string $rule): never
    {
        throw new ExportLoadException(
            'DATA_SCHEMA_INVALID',
            "Schema violation at {$path}: {$rule}",
            ['field_path' => $path, 'rule' => $rule]
        );
    }
}
