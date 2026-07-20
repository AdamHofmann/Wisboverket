import { redirect } from 'next/navigation'

// Kontoplan-vyn är inte färdig än — omdirigera tills den byggs (ingen platshållar-skärm).
export default function KontoplanPage() {
  redirect('/installningar/inkorg')
}
