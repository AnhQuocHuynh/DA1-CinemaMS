<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=false; section>
    <#if section = "form">
        <main class="flex-grow pt-16 relative overflow-hidden bg-surface text-on-surface min-h-screen">
            <div class="absolute inset-0 z-0 grid grid-cols-12 gap-4 opacity-5 pointer-events-none px-8">
                <#list 1..12 as i>
                    <div class="border-r border-outline-variant h-full"></div>
                </#list>
            </div>

            <div class="absolute -top-24 -left-24 w-72 h-72 bg-surface-container-high rounded-full blur-3xl opacity-60"></div>
            <div class="absolute bottom-0 right-0 w-96 h-96 bg-surface-container-low rounded-full blur-3xl opacity-60"></div>

            <div class="relative z-10 max-w-6xl mx-auto px-6 py-14 md:py-18 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
                
                <section class="space-y-8 hidden lg:block">
                    <div>
                        <span class="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">
                            Member Registration
                        </span>
                        <p class="text-on-surface-variant text-sm md:text-base mt-4 max-w-xl">
                            Build a dedicated booking profile with faster checkout, protected seat holds, and a
                            consolidated ticket vault.
                        </p>
                    </div>

                    <div class="rounded-2xl overflow-hidden border border-outline-variant/40 bg-surface-container-lowest">
                        <div class="relative aspect-[16/9]">
                            <img class="w-full h-full object-cover" src="${url.resourcesPath}/img/generic_movie_bg.png" alt="Cinema hall seats" />
                            <div class="absolute inset-0 bg-gradient-to-r from-surface-container-highest/80 via-surface-container-low/40 to-transparent"></div>
                            <div class="absolute bottom-6 left-6">
                                <span class="text-[10px] font-bold uppercase tracking-widest text-primary">
                                    Priority onboarding
                                </span>
                                <p class="text-sm text-on-surface mt-2 max-w-sm">
                                    Lock seats in real time with instant checkout and order tracking.
                                </p>
                            </div>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 p-6">
                            <div class="rounded-xl bg-surface-container-low p-4 border border-outline-variant/30">
                                <div class="text-xl font-semibold tracking-tight text-on-surface">Synced</div>
                                <div class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mt-2">Seat Holds</div>
                            </div>
                            <div class="rounded-xl bg-surface-container-low p-4 border border-outline-variant/30">
                                <div class="text-xl font-semibold tracking-tight text-on-surface">Encrypted</div>
                                <div class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mt-2">Ticket Vault</div>
                            </div>
                            <div class="rounded-xl bg-surface-container-low p-4 border border-outline-variant/30">
                                <div class="text-xl font-semibold tracking-tight text-on-surface">Tracked</div>
                                <div class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mt-2">Refunds</div>
                            </div>
                        </div>
                    </div>

                    <div class="rounded-2xl bg-surface-container-lowest border border-outline-variant/40 p-6">
                        <div class="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                            Booking promise
                        </div>
                        <p class="text-sm text-on-surface mt-3">
                            Your seats stay locked while you check out. The hold timer syncs to live inventory
                            and releases automatically when sessions expire.
                        </p>
                    </div>
                </section>

                <section class="bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/40 overflow-hidden bg-white">
                    <div class="px-8 pt-10 pb-6">
                        <a href="http://localhost:3000/" class="inline-flex items-center gap-2 text-sm font-semibold text-on-surface-variant hover:text-on-surface">
                            <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
                            Back to Home
                        </a>

                        <div class="flex items-center justify-between mb-8 mt-6">
                            <div>
                                <span class="text-xl font-black tracking-tighter text-on-surface block">
                                    CinemaArchitect
                                </span>
                                <h2 class="text-2xl font-semibold tracking-tight text-on-surface mt-1">
                                    Create Account
                                </h2>
                                <p class="text-on-surface-variant text-sm mt-2">
                                    Open a booking profile with verified access.
                                </p>
                            </div>                
                        </div>

                        <#if message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
                            <div class="mb-6 p-4 bg-error/10 border border-error/20 rounded-lg flex items-start gap-3">
                                <svg class="w-5 h-5 text-error mt-0.5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                                <p class="text-sm text-error">${kcSanitize(message.summary)?no_esc}</p>
                            </div>
                        </#if>

                        <form id="kc-register-form" class="space-y-6" action="${url.registrationAction}" method="post">
                            <div class="grid grid-cols-1 gap-6">
                                
                                <div class="space-y-1.5">
                                    <label for="firstName" class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1">First Name <span class="text-error">*</span></label>
                                    <div class="relative">
                                        <svg class="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-5 h-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                        <input id="firstName" name="firstName" value="${(register.formData.firstName!'')}" type="text" placeholder="John" class="w-full pl-12 pr-4 py-3 bg-surface-container-highest border-none rounded-lg focus:ring-0 text-sm placeholder:text-outline-variant transition-all border-b-2 border-transparent focus:border-primary" />
                                    </div>
                                </div>
                                
                                <div class="space-y-1.5">
                                    <label for="lastName" class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1">Last Name <span class="text-error">*</span></label>
                                    <div class="relative">
                                        <svg class="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-5 h-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                        <input id="lastName" name="lastName" value="${(register.formData.lastName!'')}" type="text" placeholder="Doe" class="w-full pl-12 pr-4 py-3 bg-surface-container-highest border-none rounded-lg focus:ring-0 text-sm placeholder:text-outline-variant transition-all border-b-2 border-transparent focus:border-primary" />
                                    </div>
                                </div>

                                <div class="space-y-1.5">
                                    <label for="email" class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1">Email Address <span class="text-error">*</span></label>
                                    <div class="relative">
                                        <svg class="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-5 h-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                                        <input id="email" name="email" value="${(register.formData.email!'')}" type="email" placeholder="name@company.com" class="w-full pl-12 pr-4 py-3 bg-surface-container-highest border-none rounded-lg focus:ring-0 text-sm placeholder:text-outline-variant transition-all border-b-2 border-transparent focus:border-primary" />
                                    </div>
                                </div>
                                
                                <div class="space-y-1.5">
                                    <label for="phone" class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1">Phone Number</label>
                                    <div class="relative">
                                        <svg class="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-5 h-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                        <input id="phone" name="user.attributes.phone" value="${(register.formData['user.attributes.phone']!'')}" type="tel" placeholder="123-456-7890" class="w-full pl-12 pr-4 py-3 bg-surface-container-highest border-none rounded-lg focus:ring-0 text-sm placeholder:text-outline-variant transition-all border-b-2 border-transparent focus:border-primary" />
                                    </div>
                                </div>
                            </div>

                            <div class="space-y-1.5">
                                <label for="password" class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1">Password <span class="text-error">*</span></label>
                                <div class="relative">
                                    <svg class="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-5 h-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                    <input id="password" name="password" type="password" placeholder="••••••••" autocomplete="new-password" class="w-full pl-12 pr-4 py-3 bg-surface-container-highest border-none rounded-lg focus:ring-0 text-sm placeholder:text-outline-variant transition-all border-b-2 border-transparent focus:border-primary" />
                                </div>
                                <p class="text-[11px] text-on-surface-variant px-1">Use at least 6 characters with a mix of letters and numbers.</p>
                            </div>

                            <div class="space-y-1.5">
                                <label for="password-confirm" class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1">Confirm Password <span class="text-error">*</span></label>
                                <div class="relative">
                                    <svg class="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-5 h-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                    <input id="password-confirm" name="password-confirm" type="password" placeholder="••••••••" class="w-full pl-12 pr-4 py-3 bg-surface-container-highest border-none rounded-lg focus:ring-0 text-sm placeholder:text-outline-variant transition-all border-b-2 border-transparent focus:border-primary" />
                                </div>
                            </div>

                            <div class="pt-2 space-y-4">
                                <div class="flex items-center justify-between rounded-lg border border-outline-variant/40 bg-surface-container-low p-4">
                                    <div>
                                        <div class="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                                            Access Tier
                                        </div>
                                        <div class="text-sm font-semibold text-on-surface mt-1">Standard Member</div>
                                    </div>
                                    <span class="text-[10px] font-bold uppercase tracking-widest text-primary">
                                        Ready
                                    </span>
                                </div>

                                <button type="submit" class="w-full py-4 bg-blue-600 text-white rounded-lg font-bold text-sm tracking-wide shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                                    CREATE ACCOUNT
                                    <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                                </button>
                            </div>
                        </form>
                    </div>

                    <div class="border-t border-outline-variant/30 px-8 py-6 text-center">
                        <p class="text-[11px] text-on-surface-variant">
                            By creating an account, you agree to our booking terms and privacy policy.
                        </p>
                        <p class="text-sm text-on-surface-variant mt-4">
                            Already have an account?{' '}
                            <a href="${url.loginUrl}" class="text-primary font-bold hover:underline">
                                Sign In
                            </a>
                        </p>
                    </div>

                    <div class="bg-surface-container-low p-4 text-center">
                        <p class="text-[10px] font-medium text-on-surface-variant uppercase tracking-widest flex items-center justify-center gap-2">
                            <svg class="w-3.5 h-3.5 text-gray-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            Secure Architect Environment
                        </p>
                    </div>
                </section>
            </div>
        </main>
    </#if>
</@layout.registrationLayout>
