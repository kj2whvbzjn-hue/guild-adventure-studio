<?php
declare(strict_types=1);
namespace GK\CPF\Generation;

use GK\CPF\Core\{CpfException, JsonStore};

final class CpfGeneratorRegistry
{
    public function __construct(private JsonStore $store = new JsonStore()) {}

    public function register(string $registryPath, array $generator): array
    {
        foreach (['generator_id', 'version', 'node_types', 'capabilities', 'priority', 'status'] as $field) {
            if (!array_key_exists($field, $generator)) {
                throw new CpfException('GENERATOR_INVALID', "Missing $field");
            }
        }
        if (!is_array($generator['node_types']) || !is_array($generator['capabilities'])) {
            throw new CpfException('GENERATOR_INVALID', 'node_types and capabilities must be arrays');
        }
        $registry = $this->load($registryPath);
        foreach ($registry['generators'] as $existing) {
            if ($existing['generator_id'] === $generator['generator_id'] && $existing['version'] === $generator['version']) {
                throw new CpfException('GENERATOR_EXISTS', 'Generator version already registered');
            }
        }
        $registry['generators'][] = $generator;
        $this->store->write($registryPath, $registry);
        return $generator;
    }

    public function unregister(string $registryPath, string $generatorId, ?string $version = null): int
    {
        $registry = $this->load($registryPath);
        $before = count($registry['generators']);
        $registry['generators'] = array_values(array_filter(
            $registry['generators'],
            static fn(array $g): bool => !($g['generator_id'] === $generatorId && ($version === null || $g['version'] === $version))
        ));
        $this->store->write($registryPath, $registry);
        return $before - count($registry['generators']);
    }

    public function resolve(string $registryPath, string $nodeType, ?string $preferredId = null, array $requiredCapabilities = []): array
    {
        $matches = array_values(array_filter($this->load($registryPath)['generators'], static function (array $g) use ($nodeType, $preferredId, $requiredCapabilities): bool {
            if (($g['status'] ?? '') !== 'ACTIVE' || !in_array($nodeType, $g['node_types'] ?? [], true)) return false;
            if ($preferredId !== null && $g['generator_id'] !== $preferredId) return false;
            return count(array_diff($requiredCapabilities, $g['capabilities'] ?? [])) === 0;
        }));
        usort($matches, static fn(array $a, array $b): int => ($b['priority'] <=> $a['priority']) ?: version_compare($b['version'], $a['version']));
        if ($matches === []) {
            throw new CpfException('GENERATOR_NOT_FOUND', "No compatible generator for $nodeType");
        }
        return $matches[0];
    }

    public function all(string $registryPath): array
    {
        return $this->load($registryPath)['generators'];
    }

    public function validateCompatibility(array $generator, string $nodeType, array $requiredCapabilities = []): array
    {
        $errors = [];
        if (($generator['status'] ?? '') !== 'ACTIVE') $errors[] = 'inactive';
        if (!in_array($nodeType, $generator['node_types'] ?? [], true)) $errors[] = 'unsupported_node_type';
        if (count(array_diff($requiredCapabilities, $generator['capabilities'] ?? [])) > 0) $errors[] = 'missing_capability';
        return ['ok' => $errors === [], 'errors' => $errors];
    }

    private function load(string $path): array
    {
        $registry = $this->store->read($path, ['version' => '1.0.0', 'generators' => []]);
        if (!is_array($registry) || !is_array($registry['generators'] ?? null)) {
            throw new CpfException('REGISTRY_INVALID', 'Invalid generator registry');
        }
        return $registry;
    }
}
