import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
} from "react";

function join(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export function ClayCard({
  className,
  elevated = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { elevated?: boolean }) {
  return (
    <div
      className={join("clay-card", elevated && "clay-card--elevated", className)}
      {...props}
    />
  );
}

export function ClayButton({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet" | "danger";
}) {
  return (
    <button
      className={join("clay-button", `clay-button--${variant}`, className)}
      {...props}
    />
  );
}

export function ClayInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={join("clay-input", className)} {...props} />;
}

export function ClaySelect({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={join("clay-select", className)} {...props} />;
}

export function ClayBadge({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return <span className={join("clay-badge", className)} {...props} />;
}
