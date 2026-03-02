import axios from 'axios'
import AxiosMockAdapter from 'axios-mock-adapter'

const api = axios.create({
  baseURL: '/api',
  timeout: 5000,
})

let jobs = []
let candidates = []
let idCounter = 1

function nextId() {
  return idCounter++
}

function computeUnreadForBoss(jobId) {
  return candidates.filter((c) => c.jobId === jobId && c.isUnreadForBoss).length
}

const mock = new AxiosMockAdapter(api, { delayResponse: 220 })

mock.onGet('/jobs').reply(() => {
  const withUnread = jobs.map((job) => ({
    ...job,
    unreadForBoss: computeUnreadForBoss(job.id),
  }))
  return [200, withUnread]
})

mock.onPost('/jobs').reply((config) => {
  const data = JSON.parse(config.data || '{}')
  const job = {
    id: nextId(),
    title: data.title ?? 'Untitled role',
    location: data.location ?? '',
    requirements: data.requirements ?? '',
    createdAt: new Date().toISOString(),
  }
  jobs.unshift(job)
  return [201, { ...job, unreadForBoss: 0 }]
})

mock.onGet(/\/jobs\/\d+\/candidates/).reply((config) => {
  const jobId = Number(config.url.split('/')[2])
  const list = candidates.filter((c) => c.jobId === jobId)
  return [200, list]
})

mock.onPost(/\/jobs\/\d+\/candidates/).reply((config) => {
  const jobId = Number(config.url.split('/')[2])
  const data = JSON.parse(config.data || '{}')
  const candidate = {
    id: nextId(),
    jobId,
    name: data.name ?? 'Unnamed candidate',
    email: data.email ?? '',
    linkedin: data.linkedin ?? '',
    resumeUrl: data.resumeUrl ?? '',
    resumeFileName: data.resumeFileName ?? '',
    notes: data.notes ?? '',
    status: 'new',
    isUnreadForBoss: true,
    isUnreadForRecruiter: false,
    lastDecisionNote: '',
    interviewTime: null,
    createdAt: new Date().toISOString(),
  }
  candidates.unshift(candidate)
  return [201, candidate]
})

mock.onPatch(/\/candidates\/\d+\/status/).reply((config) => {
  const id = Number(config.url.split('/')[2])
  const data = JSON.parse(config.data || '{}')
  const candidate = candidates.find((c) => c.id === id)
  if (!candidate) return [404, { message: 'Not found' }]

  candidate.status = data.status ?? candidate.status
  candidate.isUnreadForBoss = false
  candidate.isUnreadForRecruiter = true
  candidate.lastDecisionNote = data.note ?? ''
  candidate.interviewTime = data.interviewTime ?? candidate.interviewTime

  return [200, candidate]
})

mock.onGet('/notifications/recruiter').reply(() => {
  const list = candidates
    .filter((c) => c.isUnreadForRecruiter)
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  return [200, list]
})

function seedDemoData() {
  const now = Date.now()

  const demoJob = {
    id: nextId(),
    title: 'Senior Full Stack Engineer',
    location: 'Remote – US',
    requirements:
      '7+ years building web apps · React / Node · mentoring experience · comfortable owning roadmap.',
    createdAt: new Date(now - 1000 * 60 * 60 * 6).toISOString(),
  }

  const demoJob2 = {
    id: nextId(),
    title: 'Product Designer',
    location: 'NYC (hybrid)',
    requirements: 'Figma, UX research, previous SaaS experience.',
    createdAt: new Date(now - 1000 * 60 * 60 * 30).toISOString(),
  }

  jobs = [demoJob, demoJob2]

  candidates = [
    {
      id: nextId(),
      jobId: demoJob.id,
      name: 'Alex Johnson',
      email: 'alex@example.com',
      linkedin: 'https://linkedin.com/in/alex-j',
      resumeUrl: '',
      resumeFileName: '',
      notes: 'Very strong on backend, referred by Sam. Open to start in 4 weeks.',
      status: 'new',
      isUnreadForBoss: true,
      isUnreadForRecruiter: false,
      lastDecisionNote: '',
      interviewTime: null,
      createdAt: new Date(now - 1000 * 60 * 45).toISOString(),
    },
    {
      id: nextId(),
      jobId: demoJob.id,
      name: 'Priya Singh',
      email: 'priya@example.com',
      linkedin: '',
      resumeUrl: '',
      resumeFileName: '',
      notes: 'Great front-end portfolio, slightly below comp expectations but flexible.',
      status: 'interview',
      isUnreadForBoss: false,
      isUnreadForRecruiter: true,
      lastDecisionNote: 'Move forward for system design + culture add.',
      interviewTime: new Date(now + 1000 * 60 * 60 * 24).toISOString(),
      createdAt: new Date(now - 1000 * 60 * 120).toISOString(),
    },
    {
      id: nextId(),
      jobId: demoJob2.id,
      name: 'Taylor Lee',
      email: 'taylor@example.com',
      linkedin: '',
      resumeUrl: '',
      resumeFileName: '',
      notes: 'Strong researcher, but less SaaS experience.',
      status: 'rejected',
      isUnreadForBoss: false,
      isUnreadForRecruiter: true,
      lastDecisionNote: 'Portfolio not aligned with product-led growth focus.',
      interviewTime: null,
      createdAt: new Date(now - 1000 * 60 * 240).toISOString(),
    },
  ]
}

seedDemoData()

export { api }

