'use client';

import React from 'react';
import { WorkbookTable } from '../../workbooks/components/WorkbookTable';

export function PlacementReports() {
  return (
    <div className="space-y-6">
      <WorkbookTable moduleType="placement" />
    </div>
  );
}
