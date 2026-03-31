type BrandIconProps = {
  size?: number
  className?: string
}

export default function BrandIcon({ size = 24, className }: BrandIconProps) {
  return (
    <img
      src="/ipe-lab-icon.svg"
      alt="IPE Lab"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: 'contain', display: 'block' }}
    />
  )
}
