declare module '*.png' {
  import type { StaticImageData } from 'next/image'
  const image: StaticImageData
  export default image
}

declare module '*.jpg' {
  import type { StaticImageData } from 'next/image'
  const image: StaticImageData
  export default image
}

declare module '*.jpeg' {
  import type { StaticImageData } from 'next/image'
  const image: StaticImageData
  export default image
}

declare module '*.svg' {
  import type React from 'react'
  const component: string & React.FC<React.SVGProps<SVGSVGElement>> & { src: string }
  export default component
}
