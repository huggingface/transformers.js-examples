import { StoppingCriteria } from "@huggingface/transformers"

class InterruptableEOSStoppingCriteria extends StoppingCriteria {
  interrupted: boolean
  eos_token_id: number[]

  constructor(eos_token_id) {
    super()
    this.interrupted = false
    if (!Array.isArray(eos_token_id)) {
      eos_token_id = [eos_token_id]
    }
    this.eos_token_id = eos_token_id
  }

  interrupt() {
    this.interrupted = true
  }

  reset() {
    this.interrupted = false
  }

  _call(input_ids, scores) {
    // if interrupted, return true for all
    if (this.interrupted) {
      return new Array(input_ids.length).fill(this.interrupted)
    }

    // otherwise, check if the last token is an eos token
    return input_ids.map((ids) => {
      const last = ids.at(-1)
      // NOTE: We use == instead of === to allow for number/bigint comparison
      return this.eos_token_id.some((eos_id) => last == eos_id)
    })
  }
}

export { InterruptableEOSStoppingCriteria }
