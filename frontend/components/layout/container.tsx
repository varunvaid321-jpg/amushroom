import { cn } from "@/lib/utils";

export function Container({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mx-auto w-full max-w-[1120px] px-4 sm:px-6", className)} {...props}>
      {children}
    </div>
  );
}
