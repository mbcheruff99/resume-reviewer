import { useEffect, useState } from 'react'
import './App.css'
import { api } from './api'

function formatRelative(dateIso) {
  if (!dateIso) return ''
  const d = new Date(dateIso)
  const diffMs = Date.now() - d.getTime()
  const diffMins = Math.round(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} min ago`
  const diffHours = Math.round(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.round(diffHours / 24)
  return `${diffDays}d ago`
}

function truncate(text, max = 80) {
  if (!text) return ''
  return text.length <= max ? text : `${text.slice(0, max)}…`
}

function App() {
  const [role, setRole] = useState('recruiter')
  const [jobs, setJobs] = useState([])
  const [selectedJobRecruiter, setSelectedJobRecruiter] = useState(null)
  const [selectedJobBoss, setSelectedJobBoss] = useState(null)
  const [recruiterCandidates, setRecruiterCandidates] = useState([])
  const [bossCandidates, setBossCandidates] = useState([])
  const [selectedCandidateBossId, setSelectedCandidateBossId] = useState(null)
  const [recruiterNotifications, setRecruiterNotifications] = useState([])
  const [resumePdfFile, setResumePdfFile] = useState(null)

  const [jobForm, setJobForm] = useState({
    title: '',
    location: '',
    requirements: '',
  })

  const [candidateForm, setCandidateForm] = useState({
    name: '',
    email: '',
    linkedin: '',
    notes: '',
  })

  const [bossDecision, setBossDecision] = useState({
    note: '',
    interviewTime: '',
  })

  useEffect(() => {
    ;(async () => {
      await loadJobs()
      await loadRecruiterNotifications()
    })()
  }, [])

  async function loadJobs() {
    const res = await api.get('/jobs')
    const list = res.data
    setJobs(list)

    if (!selectedJobRecruiter && list.length) {
      const firstId = list[0].id
      setSelectedJobRecruiter(firstId)
      await loadCandidatesForRecruiter(firstId)
    }

    if (!selectedJobBoss && list.length) {
      const firstId = list[0].id
      setSelectedJobBoss(firstId)
      await loadCandidatesForBoss(firstId)
    }
  }

  async function loadCandidatesForRecruiter(jobId) {
    const res = await api.get(`/jobs/${jobId}/candidates`)
    setRecruiterCandidates(res.data)
  }

  async function loadCandidatesForBoss(jobId) {
    const res = await api.get(`/jobs/${jobId}/candidates`)
    const list = res.data
    setBossCandidates(list)
    if (!selectedCandidateBossId && list.length) {
      setSelectedCandidateBossId(list[0].id)
      setBossDecision({
        note: list[0].lastDecisionNote || '',
        interviewTime: list[0].interviewTime
          ? list[0].interviewTime.slice(0, 16)
          : '',
      })
    }
  }

  async function loadRecruiterNotifications() {
    const res = await api.get('/notifications/recruiter')
    setRecruiterNotifications(res.data)
  }

  function handleRoleChange(nextRole) {
    setRole(nextRole)
  }

  const selectedJobRecruiterObj = jobs.find((j) => j.id === selectedJobRecruiter)
  const selectedJobBossObj = jobs.find((j) => j.id === selectedJobBoss)
  const selectedCandidateBoss = bossCandidates.find(
    (c) => c.id === selectedCandidateBossId,
  )

  async function handleCreateJob(e) {
    e.preventDefault()
    if (!jobForm.title.trim()) return
    const res = await api.post('/jobs', jobForm)
    const created = res.data
    setJobs((prev) => [created, ...prev])
    setJobForm({ title: '', location: '', requirements: '' })

    if (!selectedJobRecruiter) {
      setSelectedJobRecruiter(created.id)
      await loadCandidatesForRecruiter(created.id)
    }
    if (!selectedJobBoss) {
      setSelectedJobBoss(created.id)
      await loadCandidatesForBoss(created.id)
    }
  }

  async function handleCreateCandidate(e) {
    e.preventDefault()
    if (!selectedJobRecruiter || !candidateForm.name.trim()) return

    const resumeUrl = resumePdfFile ? URL.createObjectURL(resumePdfFile) : ''
    const resumeFileName = resumePdfFile ? resumePdfFile.name : ''

    const res = await api.post(
      `/jobs/${selectedJobRecruiter}/candidates`,
      { ...candidateForm, resumeUrl, resumeFileName },
    )
    const created = res.data
    setCandidateForm({
      name: '',
      email: '',
      linkedin: '',
      notes: '',
    })
    setResumePdfFile(null)
    const fileInput = document.getElementById('candidate-resume-pdf')
    if (fileInput) fileInput.value = ''

    setRecruiterCandidates((prev) => [created, ...prev])

    if (selectedJobBoss === selectedJobRecruiter) {
      setBossCandidates((prev) => [created, ...prev])
    }
    await loadJobs()
  }

  async function handleUpdateCandidateStatus(status) {
    if (!selectedCandidateBoss) return
    const payload = {
      status,
      note: bossDecision.note.trim(),
      interviewTime:
        status === 'interview' && bossDecision.interviewTime
          ? bossDecision.interviewTime
          : null,
    }
    const res = await api.patch(
      `/candidates/${selectedCandidateBoss.id}/status`,
      payload,
    )
    const updated = res.data

    setBossCandidates((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c)),
    )
    await loadJobs()
    await loadRecruiterNotifications()

    setBossDecision({
      note: updated.lastDecisionNote || '',
      interviewTime: updated.interviewTime
        ? updated.interviewTime.slice(0, 16)
        : '',
    })
  }

  async function handleSelectJobForRecruiter(jobId) {
    setSelectedJobRecruiter(jobId)
    await loadCandidatesForRecruiter(jobId)
  }

  async function handleSelectJobForBoss(jobId) {
    setSelectedJobBoss(jobId)
    setSelectedCandidateBossId(null)
    await loadCandidatesForBoss(jobId)
  }

  function handleSelectCandidateForBoss(candidateId) {
    setSelectedCandidateBossId(candidateId)
    const cand = bossCandidates.find((c) => c.id === candidateId)
    if (cand) {
      setBossDecision({
        note: cand.lastDecisionNote || '',
        interviewTime: cand.interviewTime
          ? cand.interviewTime.slice(0, 16)
          : '',
      })
    }
  }

  const recruiterUnreadCount = recruiterNotifications.length
  const bossUnreadCountForSelectedJob = bossCandidates.filter(
    (c) => c.isUnreadForBoss,
  ).length

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">RR</span>
          <div className="brand-text">
            <h1>Resume Reviewer</h1>
            <p>Boss &amp; recruiter workflow mockup</p>
          </div>
        </div>
        <nav className="role-toggle">
          <button
            className={`role-btn ${role === 'recruiter' ? 'active' : ''}`}
            type="button"
            onClick={() => handleRoleChange('recruiter')}
          >
            Recruiter view
          </button>
          <button
            className={`role-btn ${role === 'boss' ? 'active' : ''}`}
            type="button"
            onClick={() => handleRoleChange('boss')}
          >
            Boss view
          </button>
        </nav>
      </header>

      <main className="app-main">
        <section className="panel panel-jobs">
          <div className="panel-header">
            <h2>Job postings</h2>
            <p>Create roles and see their candidates.</p>
          </div>

          <form className="card form" onSubmit={handleCreateJob}>
            <h3>Create a job</h3>
            <div className="field">
              <label htmlFor="job-title">Title</label>
              <input
                id="job-title"
                type="text"
                placeholder="Senior Backend Engineer"
                value={jobForm.title}
                onChange={(e) =>
                  setJobForm((f) => ({ ...f, title: e.target.value }))
                }
                required
              />
            </div>
            <div className="field">
              <label htmlFor="job-location">Location</label>
              <input
                id="job-location"
                type="text"
                placeholder="Remote / NYC"
                value={jobForm.location}
                onChange={(e) =>
                  setJobForm((f) => ({ ...f, location: e.target.value }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="job-requirements">Requirements</label>
              <textarea
                id="job-requirements"
                rows={3}
                placeholder="- 5+ years experience&#10;- Node / React&#10;- Comfortable owning features"
                value={jobForm.requirements}
                onChange={(e) =>
                  setJobForm((f) => ({ ...f, requirements: e.target.value }))
                }
              />
            </div>
            <button type="submit" className="btn primary">
              Post job
            </button>
          </form>

          <div className="card list-card">
            <div className="list-header">
              <h3>Open roles</h3>
              <span className="pill pill-muted">
                {jobs.length} job{jobs.length === 1 ? '' : 's'}
              </span>
            </div>
            <ul className="list" id="job-list">
              {jobs.map((job) => (
                <li
                  key={job.id}
                  className={`list-item ${
                    job.id === selectedJobRecruiter ? 'selected' : ''
                  }`}
                  onClick={() => handleSelectJobForRecruiter(job.id)}
                >
                  <div className="list-item-main">
                    <div className="list-item-title">{job.title}</div>
                    <div className="list-item-sub">
                      {job.location || 'Location TBD'} · posted{' '}
                      {formatRelative(job.createdAt)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {role === 'recruiter' && (
          <>
            <section className="panel panel-recruiter">
              <div className="panel-header">
                <h2>Recruiter workspace</h2>
                <p>Add candidates, attach resumes &amp; notes.</p>
              </div>

              {!selectedJobRecruiterObj && (
                <div className="empty-state" id="recruiter-empty">
                  <h3>Select a job</h3>
                  <p>Choose a job on the left to start adding candidates.</p>
                </div>
              )}

              {selectedJobRecruiterObj && (
                <div className="recruiter-content">
                  <div className="job-summary card small">
                    <h3 id="recruiter-job-title">
                      {selectedJobRecruiterObj.title}
                    </h3>
                    <p id="recruiter-job-meta" className="muted">
                      {selectedJobRecruiterObj.location || 'Location TBD'} ·{' '}
                      {selectedJobRecruiterObj.requirements
                        ? 'Has requirements'
                        : 'Requirements not filled yet'}
                    </p>
                    <p id="recruiter-job-reqs">
                      {selectedJobRecruiterObj.requirements ||
                        'Add requirements so the boss has context.'}
                    </p>
                  </div>

                  <form
                    className="card form small"
                    id="candidate-form"
                    onSubmit={handleCreateCandidate}
                  >
                    <h3>Add candidate</h3>
                    <div className="field-group">
                      <div className="field">
                        <label htmlFor="candidate-name">Name</label>
                        <input
                          id="candidate-name"
                          type="text"
                          placeholder="Alex Johnson"
                          value={candidateForm.name}
                          onChange={(e) =>
                            setCandidateForm((f) => ({
                              ...f,
                              name: e.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="candidate-email">Email</label>
                        <input
                          id="candidate-email"
                          type="email"
                          placeholder="alex@example.com"
                          value={candidateForm.email}
                          onChange={(e) =>
                            setCandidateForm((f) => ({
                              ...f,
                              email: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="field-group">
                      <div className="field">
                        <label htmlFor="candidate-linkedin">LinkedIn</label>
                        <input
                          id="candidate-linkedin"
                          type="url"
                          placeholder="https://linkedin.com/in/username"
                          value={candidateForm.linkedin}
                          onChange={(e) =>
                            setCandidateForm((f) => ({
                              ...f,
                              linkedin: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="candidate-resume-pdf">Resume (PDF)</label>
                        <input
                          id="candidate-resume-pdf"
                          type="file"
                          accept="application/pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null
                            setResumePdfFile(file)
                          }}
                        />
                        {resumePdfFile ? (
                          <span className="muted">{resumePdfFile.name}</span>
                        ) : (
                          <span className="muted">Choose a PDF file.</span>
                        )}
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="candidate-notes">Recruiter notes</label>
                      <textarea
                        id="candidate-notes"
                        rows={3}
                        placeholder="Strong backend, referral from Jane, notice period 2 weeks."
                        value={candidateForm.notes}
                        onChange={(e) =>
                          setCandidateForm((f) => ({
                            ...f,
                            notes: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <button type="submit" className="btn primary">
                      Add candidate
                    </button>
                  </form>

                  <div className="card list-card">
                    <div className="list-header">
                      <h3>Candidates for this role</h3>
                      <span className="pill pill-muted">
                        {recruiterCandidates.length} candidate
                        {recruiterCandidates.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <ul className="list list-candidates">
                      {recruiterCandidates.map((c) => {
                        const statusClass =
                          c.status === 'rejected'
                            ? 'rejected'
                            : c.status === 'interview'
                              ? 'interview'
                              : ''
                        return (
                          <li key={c.id} className="list-item">
                            <div className="list-item-main">
                              <div className="list-item-title">{c.name}</div>
                              <div className="list-item-sub">
                                {c.email || 'No email'} · added{' '}
                                {formatRelative(c.createdAt)}
                              </div>
                            </div>
                            <span
                              className={`pill pill-status ${statusClass}`}
                            >
                              {c.status === 'new'
                                ? 'Awaiting boss'
                                : c.status}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </div>
              )}
            </section>

            <section className="panel panel-notifications">
              <div className="panel-header">
                <h2>Boss feedback</h2>
                <p>Unread decisions from your boss.</p>
              </div>

              <div className="card list-card">
                <div className="list-header">
                  <h3>Recent updates</h3>
                  <span
                    id="recruiter-unread-pill"
                    className={`pill pill-accent ${
                      recruiterUnreadCount ? '' : 'hidden'
                    }`}
                  >
                    {recruiterUnreadCount} unread
                  </span>
                </div>
                <ul className="list">
                  {recruiterNotifications.map((c) => {
                    const job = jobs.find((j) => j.id === c.jobId)
                    const statusClass =
                      c.status === 'rejected'
                        ? 'rejected'
                        : c.status === 'interview'
                          ? 'interview'
                          : ''
                    return (
                      <li key={c.id} className="list-item">
                        <div className="list-item-main">
                          <div className="list-item-title unread">
                            {c.name} · {job ? job.title : 'Unknown role'}
                          </div>
                          <div className="list-item-sub">
                            {c.status === 'rejected'
                              ? 'Rejected'
                              : 'Interview scheduled'}{' '}
                            ·{' '}
                            {c.lastDecisionNote
                              ? truncate(c.lastDecisionNote, 70)
                              : 'No note from boss'}
                          </div>
                        </div>
                        <span
                          className={`pill pill-status ${statusClass}`}
                        >
                          {c.status}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </section>
          </>
        )}

        {role === 'boss' && (
          <section className="panel panel-boss">
            <div className="panel-header">
              <h2>Boss review</h2>
              <p>Unread applicants are highlighted; decide next steps.</p>
            </div>

            <div className="boss-layout">
              <div className="card list-card boss-jobs">
                <div className="list-header">
                  <h3>Roles</h3>
                </div>
                <ul className="list" id="boss-job-list">
                  {jobs.map((job) => (
                    <li
                      key={job.id}
                      className={`list-item ${
                        job.id === selectedJobBoss ? 'selected' : ''
                      }`}
                      onClick={() => handleSelectJobForBoss(job.id)}
                    >
                      <div className="list-item-main">
                        <div className="list-item-title">{job.title}</div>
                        <div className="list-item-sub">
                          {job.location || 'Location TBD'} ·{' '}
                          {job.unreadForBoss || 0} unread
                        </div>
                      </div>
                      {job.unreadForBoss ? (
                        <span className="pill pill-accent">
                          <span className="pill-dot" />
                          {job.unreadForBoss}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="boss-main">
                <div className="card list-card boss-candidates">
                  <div className="list-header">
                    <h3>Applicants</h3>
                    <span
                      id="boss-unread-pill"
                      className={`pill pill-accent ${
                        bossUnreadCountForSelectedJob ? '' : 'hidden'
                      }`}
                    >
                      {bossUnreadCountForSelectedJob} unread
                    </span>
                  </div>
                  <ul className="list list-candidates" id="boss-candidate-list">
                    {bossCandidates.map((c) => {
                      const titleClass = c.isUnreadForBoss
                        ? 'list-item-title unread'
                        : 'list-item-title'
                      const statusClass =
                        c.status === 'rejected'
                          ? 'rejected'
                          : c.status === 'interview'
                            ? 'interview'
                            : ''
                      return (
                        <li
                          key={c.id}
                          className={`list-item ${
                            c.id === selectedCandidateBossId ? 'selected' : ''
                          }`}
                          onClick={() => handleSelectCandidateForBoss(c.id)}
                        >
                          <div className="list-item-main">
                            <div className={titleClass}>
                              {c.name}
                              {c.isUnreadForBoss && (
                                <span
                                  className="pill-dot"
                                  style={{
                                    marginLeft: 6,
                                    display: 'inline-block',
                                  }}
                                />
                              )}
                            </div>
                            <div className="list-item-sub">
                              {truncate(
                                c.notes || 'No recruiter notes yet.',
                                60,
                              )}
                            </div>
                          </div>
                          <span
                            className={`pill pill-status ${statusClass}`}
                          >
                            {c.status === 'new'
                              ? 'Needs review'
                              : c.status}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>

                {!selectedCandidateBoss && (
                  <div className="card boss-detail" id="boss-detail-empty">
                    <h3>Select an applicant</h3>
                    <p>
                      Click on a name to see resume, LinkedIn, and recruiter
                      notes.
                    </p>
                  </div>
                )}

                {selectedCandidateBoss && (
                  <div className="card boss-detail" id="boss-detail">
                    <header className="detail-header">
                      <div>
                        <h3 id="boss-candidate-name">
                          {selectedCandidateBoss.name}
                        </h3>
                        <p id="boss-candidate-status" className="muted">
                          {selectedCandidateBoss.status === 'new'
                            ? 'Awaiting decision'
                            : selectedCandidateBoss.status === 'rejected'
                              ? 'Rejected'
                              : 'Interview scheduled'}
                        </p>
                      </div>
                      <div id="boss-badges" className="badge-row">
                        {selectedCandidateBoss.isUnreadForBoss && (
                          <span className="pill pill-accent">Unread</span>
                        )}
                        {selectedCandidateBoss.status === 'interview' &&
                          selectedCandidateBoss.interviewTime && (
                            <span className="pill pill-status interview">
                              {`Interview on ${new Date(
                                selectedCandidateBoss.interviewTime,
                              ).toLocaleString()}`}
                            </span>
                          )}
                      </div>
                    </header>

                    <div className="detail-grid">
                      <div className="detail-section">
                        <h4>Profile</h4>
                        <p
                          id="boss-candidate-email"
                          className="muted"
                        >
                          {selectedCandidateBoss.email ||
                            'No email provided'}
                        </p>
                        <p>
                          <a
                            id="boss-candidate-linkedin"
                            href={
                              selectedCandidateBoss.linkedin || '#'
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="link"
                          >
                            {selectedCandidateBoss.linkedin
                              ? 'LinkedIn profile'
                              : 'No LinkedIn link'}
                          </a>
                        </p>
                        <p>
                          <a
                            id="boss-candidate-resume"
                            href={
                              selectedCandidateBoss.resumeUrl || '#'
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="link"
                          >
                            {selectedCandidateBoss.resumeUrl
                              ? `Open resume${
                                  selectedCandidateBoss.resumeFileName
                                    ? ` (${selectedCandidateBoss.resumeFileName})`
                                    : ''
                                }`
                              : 'No resume uploaded'}
                          </a>
                        </p>
                      </div>
                      <div className="detail-section">
                        <h4>Recruiter notes</h4>
                        <p id="boss-candidate-notes">
                          {selectedCandidateBoss.notes ||
                            'Recruiter has not added notes yet.'}
                        </p>
                      </div>
                    </div>

                    <div className="detail-actions">
                      <div className="field">
                        <label htmlFor="boss-interview-notes">
                          Interview notes / talking points
                        </label>
                        <textarea
                          id="boss-interview-notes"
                          rows={2}
                          placeholder="If moving to interview, jot down focus areas (e.g. system design, leadership)."
                          value={bossDecision.note}
                          onChange={(e) =>
                            setBossDecision((prev) => ({
                              ...prev,
                              note: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="action-row">
                        <button
                          id="boss-reject-btn"
                          className="btn subtle danger"
                          type="button"
                          onClick={() => handleUpdateCandidateStatus('rejected')}
                        >
                          Reject
                        </button>
                        <div className="interview-controls">
                          <input
                            id="boss-interview-time"
                            className="input-compact"
                            type="datetime-local"
                            value={bossDecision.interviewTime}
                            onChange={(e) =>
                              setBossDecision((prev) => ({
                                ...prev,
                                interviewTime: e.target.value,
                              }))
                            }
                          />
                          <button
                            id="boss-interview-btn"
                            className="btn primary"
                            type="button"
                            onClick={() =>
                              handleUpdateCandidateStatus('interview')
                            }
                          >
                            Set up interview
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
