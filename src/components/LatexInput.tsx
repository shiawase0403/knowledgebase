import React, { useState } from 'react';
import Latex from 'react-latex-next';
import { Textarea, TextareaProps } from './ui/textarea';
import { Input, InputProps } from './ui/input';

interface LatexTextareaProps extends TextareaProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

export function LatexTextarea({ value, onChange, className, ...props }: LatexTextareaProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div 
      className={`relative rounded-md border border-input bg-background min-h-[80px] cursor-text focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background ${className || ''}`}
      onClick={() => setIsEditing(true)}
    >
      {isEditing ? (
        <Textarea
          value={value}
          onChange={onChange}
          onBlur={() => setIsEditing(false)}
          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none min-h-[80px]"
          autoFocus
          {...props}
        />
      ) : (
        <div className="px-3 py-2 text-sm text-zinc-700 whitespace-pre-wrap">
          {value ? <Latex>{value}</Latex> : <span className="text-muted-foreground">{props.placeholder || '点击输入内容...'}</span>}
        </div>
      )}
    </div>
  );
}

interface LatexInputProps extends InputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function LatexInput({ value, onChange, className, ...props }: LatexInputProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div 
      className={`relative rounded-md border border-zinc-200 bg-white h-10 flex items-center cursor-text focus-within:ring-2 focus-within:ring-zinc-950 focus-within:ring-offset-2 focus-within:ring-offset-white ${className || ''}`}
      onClick={() => setIsEditing(true)}
    >
      {isEditing ? (
        <Input
          value={value}
          onChange={onChange}
          onBlur={() => setIsEditing(false)}
          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-full"
          autoFocus
          {...props}
        />
      ) : (
        <div className="px-3 py-2 text-sm text-zinc-700 w-full overflow-hidden text-ellipsis whitespace-nowrap">
          {value ? <Latex>{value}</Latex> : <span className="text-zinc-500">{props.placeholder || '点击输入内容...'}</span>}
        </div>
      )}
    </div>
  );
}
