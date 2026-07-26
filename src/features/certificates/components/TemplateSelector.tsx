import React from 'react';

interface Template {
  id: string;
  name: string;
  preview_url?: string;
}

interface Props {
  templates: Template[];
  selectedTemplate: Template | null;
  onSelect: (template: Template) => void;
}

export default function TemplateSelector({ templates, selectedTemplate, onSelect }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {templates.map(template => (
        <div
          key={template.id}
          onClick={() => onSelect(template)}
          className={`border-2 rounded-2xl overflow-hidden cursor-pointer transition-all
            ${selectedTemplate?.id === template.id ? 'border-blue-600' : 'border-gray-200 hover:border-gray-300'}
          `}
        >
          <div className="h-40 bg-gray-100 flex items-center justify-center">
            {template.preview_url ? (
              <img src={template.preview_url} alt={template.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-gray-400">Preview</span>
            )}
          </div>
          <div className="p-4">
            <p className="font-semibold text-center">{template.name}</p>
          </div>
        </div>
      ))}
    </div>
  );
}