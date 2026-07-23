"use client";

import { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

const fieldBase =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 disabled:bg-slate-50 disabled:text-slate-400";

function Label({ children, required }: { children: string; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-sm font-medium text-slate-700">
      {children}
      {required && <span className="text-danger-500"> *</span>}
    </label>
  );
}

function ErrorText({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="mt-1 text-xs text-danger-500">{error}</p>;
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, required, className, ...props }, ref) => (
    <div>
      {label && <Label required={required}>{label}</Label>}
      <input ref={ref} className={cn(fieldBase, className)} {...props} />
      <ErrorText error={error} />
    </div>
  )
);
Input.displayName = "Input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, required, className, ...props }, ref) => (
    <div>
      {label && <Label required={required}>{label}</Label>}
      <textarea ref={ref} className={cn(fieldBase, "min-h-[80px] resize-y", className)} {...props} />
      <ErrorText error={error} />
    </div>
  )
);
Textarea.displayName = "Textarea";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, required, className, children, ...props }, ref) => (
    <div>
      {label && <Label required={required}>{label}</Label>}
      <select ref={ref} className={cn(fieldBase, "bg-white", className)} {...props}>
        {children}
      </select>
      <ErrorText error={error} />
    </div>
  )
);
Select.displayName = "Select";
