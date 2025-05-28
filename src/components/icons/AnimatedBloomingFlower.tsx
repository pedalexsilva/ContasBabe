
"use client";

import { BloomingFlowerIcon } from '@/components/icons/BloomingFlowerIcon';
import { cn } from '@/lib/utils';

interface AnimatedBloomingFlowerProps {
  className?: string;
}

export function AnimatedBloomingFlower({ className }: AnimatedBloomingFlowerProps) {
  return (
    <BloomingFlowerIcon
      className={cn("animate-bloom h-6 w-6 text-primary", className)} // Adjust size as needed
      data-ai-hint="animated flower"
    />
  );
}
