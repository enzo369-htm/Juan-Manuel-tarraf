import { handleWeb } from './bridge'

export default {
  fetch(request: Request) {
    return handleWeb(request)
  },
}
