import { redirect } from 'next/navigation'

// Momskod-mappning byggs i en senare fas — omdirigera tills dess (ingen platshållar-skärm).
export default function MomsPage() {
  redirect('/installningar/inkorg')
}
