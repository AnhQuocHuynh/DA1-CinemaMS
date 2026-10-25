<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false>
<!DOCTYPE html>
<html lang="${(locale.currentLanguageTag!locale.current!'en')}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${msg("loginTitle",(realm.displayName!'CinemaArchitect'))}</title>
    <link rel="icon" href="${url.resourcesPath}/img/favicon.ico" />

    <!-- Pre-render Theme Setup: prevent flash of light theme -->
    <script>
        (function() {
            const urlParams = new URLSearchParams(window.location.search);
            const queryTheme = urlParams.get('theme');
            const savedTheme = localStorage.getItem('cinema_theme');
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            
            // Priority: URL query param -> localStorage -> system default
            const themePref = queryTheme || savedTheme || 'system';
            const isDark = themePref === 'dark' || (themePref === 'system' && prefersDark);

            if (isDark) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
            
            // Persist the preference
            localStorage.setItem('cinema_theme', themePref);
        })();
    </script>

    <#if properties.styles?has_content>
        <#list properties.styles?split(' ') as style>
            <link href="${url.resourcesPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
</head>
<body class="bg-surface text-on-surface min-h-screen flex flex-col m-0 p-0 transition-colors duration-200">
    
    <!-- Top Utility Toolbar: Language Selector & Theme Toggle -->
    <header class="fixed top-4 right-6 z-[70] flex items-center gap-3">
        <!-- Language Selector -->
        <#if realm.internationalizationEnabled?? && realm.internationalizationEnabled && locale?? && locale.supported?? && (locale.supported?size > 1)>
            <div class="flex items-center gap-1 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm text-slate-700 dark:text-slate-200 text-xs">
                <svg class="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                <#list locale.supported as l>
                    <a href="${l.url}" onclick="localStorage.setItem('cinema_lang', '${l.languageTag}');" class="px-1.5 py-0.5 rounded hover:text-blue-600 dark:hover:text-blue-400 transition-colors <#if l.languageTag == (locale.currentLanguageTag!locale.current!'en')>font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50</#if>">
                        ${l.languageTag?upper_case}
                    </a>
                    <#if l_has_next><span class="text-slate-300 dark:text-slate-600">|</span></#if>
                </#list>
            </div>
        <#else>
            <!-- Fallback language selector -->
            <div class="flex items-center gap-1 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm text-slate-700 dark:text-slate-200 text-xs">
                <svg class="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                <a href="?kc_locale=en" onclick="localStorage.setItem('cinema_lang', 'en');" class="px-1.5 py-0.5 rounded hover:text-blue-600 <#if (locale.currentLanguageTag!locale.current!'en') == 'en'>font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/50</#if>">EN</a>
                <span class="text-slate-300 dark:text-slate-600">|</span>
                <a href="?kc_locale=vi" onclick="localStorage.setItem('cinema_lang', 'vi');" class="px-1.5 py-0.5 rounded hover:text-blue-600 <#if (locale.currentLanguageTag!locale.current!'') == 'vi'>font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/50</#if>">VI</a>
            </div>
        </#if>

        <!-- Dark / Light Mode Toggle Button -->
        <button id="theme-toggle" type="button" aria-label="Toggle theme" class="p-2 rounded-lg bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-gray-200 dark:border-slate-700 shadow-sm text-slate-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all active:scale-95">
            <!-- Sun icon (visible in dark mode) -->
            <svg id="sun-icon" class="w-4 h-4 hidden" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
            <!-- Moon icon (visible in light mode) -->
            <svg id="moon-icon" class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
        </button>
    </header>

    <#nested "form">

    <!-- Theme Toggle Interaction Script -->
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const toggleBtn = document.getElementById('theme-toggle');
            const sunIcon = document.getElementById('sun-icon');
            const moonIcon = document.getElementById('moon-icon');

            function syncIcon() {
                const isDark = document.documentElement.classList.contains('dark');
                if (isDark) {
                    sunIcon?.classList.remove('hidden');
                    moonIcon?.classList.add('hidden');
                } else {
                    sunIcon?.classList.add('hidden');
                    moonIcon?.classList.remove('hidden');
                }
            }

            syncIcon();

            toggleBtn?.addEventListener('click', function() {
                const isDark = document.documentElement.classList.toggle('dark');
                const newTheme = isDark ? 'dark' : 'light';
                localStorage.setItem('cinema_theme', newTheme);
                syncIcon();
            });

            // Listen for OS color scheme changes when theme is set to 'system'
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
                const current = localStorage.getItem('cinema_theme') || 'system';
                if (current === 'system') {
                    if (e.matches) {
                        document.documentElement.classList.add('dark');
                    } else {
                        document.documentElement.classList.remove('dark');
                    }
                    syncIcon();
                }
            });
        });
    </script>
</body>
</html>
</#macro>
