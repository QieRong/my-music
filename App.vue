<script>
	import { hydrateDisclaimer } from './stores/appStore'
	import { hydrateLibrary } from './stores/libraryStore'
	import { hydrateSources, sourceState } from './stores/sourceStore'
	import { hydrateSourceExecutionConsents } from './utils/sourceExecutionConsent'
	import { hydrateLocale } from './utils/i18n'

	export default {
		onLaunch: async function() {
			hydrateLocale()
			hydrateDisclaimer()
			hydrateLibrary()
			hydrateSources()
			await hydrateSourceExecutionConsents(sourceState.items)
			console.log('App Launch')
		},
		onShow: function() {
			console.log('App Show')
		},
		onHide: function() {
			console.log('App Hide')
		}
	}
</script>

<style>
	html,
	body,
	#app,
	uni-app,
	uni-page,
	uni-page-body,
	uni-page-wrapper,
	page {
		background: #0b0d10;
		min-height: 100%;
	}

	html,
	body,
	#app,
	uni-app {
		margin: 0;
		min-height: 100vh;
	}

	body {
		overflow-x: hidden;
	}

	html,
	body,
	uni-page-body,
	uni-page-wrapper,
	uni-scroll-view,
	.uni-scroll-view {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}

	html::-webkit-scrollbar,
	body::-webkit-scrollbar,
	uni-page-body::-webkit-scrollbar,
	uni-page-wrapper::-webkit-scrollbar,
	uni-scroll-view::-webkit-scrollbar,
	.uni-scroll-view::-webkit-scrollbar {
		display: none;
		height: 0;
		width: 0;
	}
</style>
