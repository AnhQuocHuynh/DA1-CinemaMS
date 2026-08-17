<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=false; section>
    <#if section = "form">
        <main class="flex-grow pt-16 relative overflow-hidden h-screen w-full bg-white">
            <div class="absolute inset-0 z-0 grid grid-cols-12 gap-4 opacity-5 pointer-events-none px-8">
                <#list 1..12 as i>
                    <div class="border-r border-outline-variant h-full"></div>
                </#list>
            </div>

            <div class="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
                <div class="absolute inset-0 bg-white"></div>
                <div class="relative w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col transform transition-all border border-gray-100">
                    <div class="p-8 sm:p-10">
                        <a href="${url.loginUrl}" class="inline-flex items-center gap-2 text-sm font-semibold text-on-surface-variant hover:text-on-surface mb-6">
                            <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
                            Back to Login
                        </a>

                        <div class="mb-10 text-center">
                            <span class="text-xl font-black tracking-tighter text-on-surface block mb-2">
                                CinemaArchitect
                            </span>
                            <h1 class="text-2xl font-semibold tracking-tight text-on-surface">Reset Password</h1>
                            <p class="text-on-surface-variant text-sm mt-1">
                                Enter your email to receive a password reset link.
                            </p>
                        </div>

                        <#if message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
                            <div class="mb-6 p-4 bg-error/10 border border-error/20 rounded-lg flex items-start gap-3">
                                <svg class="w-5 h-5 text-error mt-0.5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                                <p class="text-sm text-error">${kcSanitize(message.summary)?no_esc}</p>
                            </div>
                        </#if>

                        <form id="kc-reset-password-form" class="space-y-6" action="${url.loginAction}" method="post">
                            <div class="space-y-1.5">
                                <label for="username" class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1">Email Address <span class="text-error">*</span></label>
                                <div class="relative">
                                    <svg class="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-5 h-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                                    <input type="text" id="username" name="username" class="w-full pl-12 pr-4 py-3 bg-surface-container-highest border-none rounded-lg focus:ring-0 text-sm placeholder:text-outline-variant transition-all border-b-2 border-transparent focus:border-primary" autofocus value="${(auth.attemptedUsername!'')}" aria-invalid="<#if messagesPerField.existsError('username')>true</#if>"/>
                                </div>
                            </div>

                            <button type="submit" class="w-full py-4 bg-blue-600 text-white rounded-lg font-bold text-sm tracking-wide shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                                SEND RESET LINK
                                <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </main>
    </#if>
</@layout.registrationLayout>
