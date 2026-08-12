import { pathToFileURL } from 'node:url'

const vueEntry = process.env.MUSIC_SHELL_VUE_ENTRY
  || 'E:\\HBuilderX\\plugins\\uniapp-cli-vite\\node_modules\\vue\\index.mjs'
const vueEntryUrl = pathToFileURL(vueEntry).href

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'vue') {
    return {
      shortCircuit: true,
      url: vueEntryUrl
    }
  }

  return nextResolve(specifier, context)
}
