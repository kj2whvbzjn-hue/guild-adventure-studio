<?php
declare(strict_types=1);
namespace GK\CPF\Approval;

use GK\CPF\Core\CpfNodeManager;

final class CpfApprovalManager
{
    public function __construct(private CpfNodeManager $nodes = new CpfNodeManager()) {}

    public function approve(string $projectDir, string $nodeId, string $approvedBy = 'user'): array
    {
        return $this->nodes->setStatus(
            $projectDir,
            $nodeId,
            'APPROVED',
            ['approved_by' => $approvedBy, 'approved_at' => date(DATE_ATOM)],
            'approved by ' . $approvedBy
        );
    }

    public function reject(string $projectDir, string $nodeId, string $reason): array
    {
        return $this->nodes->setStatus(
            $projectDir,
            $nodeId,
            'REJECTED',
            ['rejection_reason' => $reason],
            $reason
        );
    }
}
