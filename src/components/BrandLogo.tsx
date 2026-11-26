'use client';

import React from 'react';

export default function BrandLogo({
  variant = 'wordmark',
  size = 'md',
  subtitle,
  className = '',
}: {
  variant?: 'wordmark' | 'mark' | 'hero';
  size?: 'sm' | 'md' | 'lg';
  subtitle?: string;
  className?: string;
}) {
  if (variant === 'mark') {
    const dim = size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-12 h-12' : 'w-9 h-9';
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/brand/logo-mark.png"
        alt="PROJECT X FILES — CLASSIFIED"
        className={`${dim} rounded-sm object-contain shrink-0 select-none ${className}`}
      />
    );
  }

  if (variant === 'hero') {
    return (
      <div className={`inline-flex flex-col items-start gap-2 ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo-wordmark.png"
          alt="PROJECT X FILES — CLASSIFIED"
          className="h-14 sm:h-16 w-auto object-contain select-none"
        />
        {subtitle && (
          <div className="font-mono text-[10px] tracking-[0.22em] text-[#7f8ca1] uppercase">
            {subtitle}
          </div>
        )}
      </div>
    );
  }

  const heightCls =
    size === 'sm' ? 'h-7 sm:h-8' : size === 'lg' ? 'h-10 sm:h-11' : 'h-8 sm:h-9';

  return (
    <div className={`inline-flex items-center gap-3 min-w-0 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo-wordmark.png"
        alt="PROJECT X FILES — CLASSIFIED"
        className={`${heightCls} w-auto object-contain shrink-0 select-none`}
      />
      {subtitle && (
        <div className="hidden md:block border-l border-[#262f40] pl-3 leading-tight">
          <div className="font-mono text-[10px] tracking-[0.18em] text-[#8b98ae] uppercase whitespace-nowrap">
            {subtitle}
          </div>
        </div>
      )}
    </div>
  );
}
