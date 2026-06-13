import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'

const SignaturePad = forwardRef(({ width = 500, height = 150 }, ref) => {
  const canvasRef = useRef()
  const drawing = useRef(false)

  useImperativeHandle(ref, () => ({
    isEmpty: () => {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      return !data.some(channel => channel !== 0)
    },
    clear: () => {
      const canvas = canvasRef.current
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    },
    getTrimmedCanvas: () => canvasRef.current,
  }))

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.strokeStyle = '#1e1b4b'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const clientY = e.touches ? e.touches[0].clientY : e.clientY
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      }
    }

    const start = (e) => {
      e.preventDefault()
      drawing.current = true
      const pos = getPos(e)
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
    }

    const draw = (e) => {
      e.preventDefault()
      if (!drawing.current) return
      const pos = getPos(e)
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
    }

    const stop = () => { drawing.current = false }

    canvas.addEventListener('mousedown', start)
    canvas.addEventListener('mousemove', draw)
    canvas.addEventListener('mouseup', stop)
    canvas.addEventListener('mouseleave', stop)
    canvas.addEventListener('touchstart', start, { passive: false })
    canvas.addEventListener('touchmove', draw, { passive: false })
    canvas.addEventListener('touchend', stop)

    return () => {
      canvas.removeEventListener('mousedown', start)
      canvas.removeEventListener('mousemove', draw)
      canvas.removeEventListener('mouseup', stop)
      canvas.removeEventListener('mouseleave', stop)
      canvas.removeEventListener('touchstart', start)
      canvas.removeEventListener('touchmove', draw)
      canvas.removeEventListener('touchend', stop)
    }
  }, [])

  return (
    <canvas ref={canvasRef} width={width} height={height}
      style={{ touchAction: 'none', cursor: 'crosshair', width: '100%' }}
      className="rounded-lg" />
  )
})

SignaturePad.displayName = 'SignaturePad'
export default SignaturePad
