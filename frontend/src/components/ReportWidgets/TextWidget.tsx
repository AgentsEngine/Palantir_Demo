import React from 'react';
import type { WidgetInstance } from './types';

interface Props {
  widget: WidgetInstance;
}

export default function TextWidget({ widget }: Props) {
  return (
    <div style={{ padding: 16, height: '100%', display: 'flex', alignItems: 'center' }}>
      <div style={{ fontSize: 14, color: '#333', lineHeight: 1.6 }}>
        {widget.title || '文本标注'}
      </div>
    </div>
  );
}
