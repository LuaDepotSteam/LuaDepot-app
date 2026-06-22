const tl = gsap
  .timeline({
    repeat: -1,
    defaults:{ duration: 3, ease: 'power1.inOut' }
  })
  .set('#svg-stage', { opacity: 1 })
  .from('path', { drawSVG:'0% 0%' })
  .to('path', { drawSVG:'100% 100%' })
