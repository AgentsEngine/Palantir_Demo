import React from 'react';
import { DeleteOutlined, DragOutlined } from '@ant-design/icons';
import type { WidgetInstance } from './types';

interface Props {
  widget: WidgetInstance;
  isEditing: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}

export default function WidgetWrapper({ widget, isEditing, isSelected, onSelect, onDelete, children }: Props) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      style={{
        position: 'absolute',
        left: `${(widget.position.x / 24) * 100}%`,
        top: `${widget.position.y * 50}px`,
        width: `${(widget.position.w / 24) * 100}%`,
        height: `${widget.position.h * 50}px`,
        background: '#fff',
        border: isSelected ? '2px solid #1677ff' : '1px solid #e8e8e8',
        borderRadius: 6,
        overflow: 'hidden',
        cursor: isEditing ? 'move' : 'default',
        boxShadow: isSelected ? '0 2px 8px rgba(22,119,255,0.15)' : '0 1px 2px rgba(0,0,0,0.06)',
        transition: 'box-shadow 0.2s, border-color 0.2s',
      }}
    >
      {isEditing && (
        <div
          style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            height: 24, background: isSelected ? '#1677ff' : '#f5f5f5',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 8px', fontSize: 12, zIndex: 10,
            color: isSelected ? '#fff' : '#999',
          }}
        >
          <span><DragOutlined style={{ marginRight: 4 }} />{widget.title || widget.type}</span>
          {isSelected && (
            <DeleteOutlined
              style={{ cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            />
          )}
        </div>
      )}
      <div style={{ padding: isEditing ? '24px 8px 8px' : 8, height: isEditing ? 'calc(100% - 24px)' : '100%' }}>
        {children}
      </div>
    </div>
  );
}
