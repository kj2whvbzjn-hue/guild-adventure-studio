<?php
declare(strict_types=1);
namespace GK\Export;

final class DeterministicRandom
{
    private int $state;
    public function __construct(int $seed) { $this->state = $seed !== 0 ? $seed : 0x6d2b79f5; }
    public function nextInt(): int
    {
        $x = $this->state;
        $x ^= ($x << 13);
        $x ^= ($x >> 17);
        $x ^= ($x << 5);
        $this->state = $x & 0x7fffffff;
        return $this->state;
    }
    public function float(): float { return $this->nextInt() / 0x7fffffff; }
    public function range(int $min, int $max): int
    {
        if ($max < $min) { [$min,$max]=[$max,$min]; }
        return $min + ($this->nextInt() % (($max-$min)+1));
    }
}
