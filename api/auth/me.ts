import { isAuthed } from '../session'

export default {
  async fetch(request: Request) {
    return Response.json({ ok: await isAuthed(request) })
  },
}
