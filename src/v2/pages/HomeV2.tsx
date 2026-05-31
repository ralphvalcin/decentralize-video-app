import { JoinForm } from './home/JoinForm'
import { PreflightPanel } from './home/PreflightPanel'

export default function HomeV2() {
  return (
    <div className="v2 flex min-h-screen">
      <div className="flex-1 border-r border-[var(--border-subtle)]">
        <JoinForm />
      </div>
      <div className="flex-1">
        <PreflightPanel />
      </div>
    </div>
  )
}
