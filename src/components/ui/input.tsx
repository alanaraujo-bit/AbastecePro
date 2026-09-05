"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

const BASE_CAMPO =
  "w-full rounded-app border bg-surface px-3.5 text-text placeholder:text-text-muted " +
  "transition-[border-color,box-shadow] duration-150 " +
  "focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/12 " +
  "disabled:opacity-50";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  rotulo?: string;
  dica?: string;
  erro?: string;
  prefixo?: React.ReactNode;
  sufixo?: React.ReactNode;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, rotulo, dica, erro, prefixo, sufixo, id, ...props },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;

  return (
    <div className="w-full">
      {rotulo && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium text-text-secondary"
        >
          {rotulo}
        </label>
      )}
      <div className="relative">
        {prefixo && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted">
            {prefixo}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro || dica ? `${inputId}-msg` : undefined}
          className={cn(
            BASE_CAMPO,
            "h-12",
            prefixo && "pl-10",
            sufixo && "pr-10",
            erro
              ? "border-danger focus:border-danger focus:ring-danger/12"
              : "border-border",
            className,
          )}
          {...props}
        />
        {sufixo && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted">
            {sufixo}
          </span>
        )}
      </div>
      {(erro || dica) && (
        <p
          id={`${inputId}-msg`}
          className={cn(
            "mt-1.5 text-sm leading-snug",
            erro ? "text-danger" : "text-text-muted",
          )}
        >
          {erro || dica}
        </p>
      )}
    </div>
  );
});

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  rotulo?: string;
  dica?: string;
  erro?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, rotulo, dica, erro, id, ...props }, ref) {
    const auto = useId();
    const areaId = id ?? auto;
    return (
      <div className="w-full">
        {rotulo && (
          <label
            htmlFor={areaId}
            className="mb-1.5 block text-sm font-medium text-text-secondary"
          >
            {rotulo}
          </label>
        )}
        <textarea
          ref={ref}
          id={areaId}
          className={cn(
            BASE_CAMPO,
            "min-h-24 resize-none py-3 leading-snug",
            erro
              ? "border-danger focus:border-danger focus:ring-danger/12"
              : "border-border",
            className,
          )}
          {...props}
        />
        {(erro || dica) && (
          <p
            className={cn(
              "mt-1.5 text-sm leading-snug",
              erro ? "text-danger" : "text-text-muted",
            )}
          >
            {erro || dica}
          </p>
        )}
      </div>
    );
  },
);

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  rotulo?: string;
  dica?: string;
  erro?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ className, rotulo, dica, erro, id, children, ...props }, ref) {
    const auto = useId();
    const selId = id ?? auto;
    return (
      <div className="w-full">
        {rotulo && (
          <label
            htmlFor={selId}
            className="mb-1.5 block text-sm font-medium text-text-secondary"
          >
            {rotulo}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selId}
            className={cn(
              BASE_CAMPO,
              "h-12 cursor-pointer appearance-none pr-10",
              erro ? "border-danger" : "border-border",
              className,
            )}
            {...props}
          >
            {children}
          </select>
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-text-muted"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m5 7.5 5 5 5-5" />
          </svg>
        </div>
        {(erro || dica) && (
          <p
            className={cn(
              "mt-1.5 text-sm leading-snug",
              erro ? "text-danger" : "text-text-muted",
            )}
          >
            {erro || dica}
          </p>
        )}
      </div>
    );
  },
);
