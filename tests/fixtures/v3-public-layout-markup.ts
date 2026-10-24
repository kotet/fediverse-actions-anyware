/**
 * Markup of the public pages Mastodon 3.x serves to signed-out visitors.
 *
 * Taken from `https://mstdn.nere9.help` (3.5.18) with the post bodies, names and
 * avatars replaced and everything not around the posts left out. The structure,
 * classes and the `/interact/` links are as served.
 */

/** Boot payload of a page served to a signed-out visitor: `meta` has no `me`. */
const SIGNED_OUT_INITIAL_STATE = `<script id="initial-state" type="application/json">{"meta":{"streaming_api_base_url":"wss://mstdn.nere9.help","access_token":null,"locale":"ja","domain":"mstdn.nere9.help","version":"3.5.18"},"compose":{"text":""},"accounts":{}}</script>`;

/**
 * A status page as the server renders it: a post this one replies to, the post
 * itself, and a followers-only reply that cannot be boosted.
 */
export const V3_STATUS_PAGE =`${SIGNED_OUT_INITIAL_STATE}
<div class='public-layout'>
<div class='container'><div class='grid'>
<div class='column-0'>
<div class='activity-stream h-entry'>
<div class='entry h-cite p-in-reply-to entry-predecessor'>
<div class='status status-public'>
<div class='status__info'>
<a class="status__relative-time u-url u-uid" rel="noopener noreferrer" href="https://mstdn.nere9.help/@alice/100000000000000001"><span class='status__visibility-icon'><i title="公開" class="fa fa-globe"></i></span><time class='time-ago' datetime='2026-10-18T08:24:56Z'>2026年10月18日 08:24</time>
</a><data class='dt-published' value='2026-10-18T08:24:56+00:00'></data>
<div class='p-author h-card'>
<a class="status__display-name u-url" rel="noopener noreferrer" href="https://mstdn.nere9.help/@alice"><span class='display-name'><bdi><strong class='display-name__html p-name emojify'>Alice</strong></bdi></span></a>
</div>
</div>
<div class='status__content emojify'><div class='e-content'>
<p>The post being replied to.</p>
</div></div>
<div class='status__action-bar'>
<a class="status__action-bar-button icon-button icon-button--with-counter modal-button" href="/interact/100000000000000001?type=reply"><i class="fa fa-reply fa-fw"></i>
<span class='icon-button__counter'>1</span>
</a><a class="status__action-bar-button icon-button modal-button" href="/interact/100000000000000001?type=reblog"><i class="fa fa-retweet fa-fw"></i>
</a><a class="status__action-bar-button icon-button modal-button" href="/interact/100000000000000001?type=favourite"><i class="fa fa-star fa-fw"></i>
</a></div>
</div>
</div>
<div class='entry entry-center'>
<div class='detailed-status detailed-status--flex detailed-status-public'>
<div class='p-author h-card'>
<a class="detailed-status__display-name u-url" rel="noopener" href="https://mstdn.nere9.help/@alice"><span class='display-name'><bdi><strong class='display-name__html p-name emojify'>Alice</strong></bdi></span></a>
</div>
<div class='status__content emojify'><div class='e-content'>
<p>The post this page is about.</p>
</div></div>
<div class='detailed-status__meta'>
<data class='dt-published' value='2026-10-24T09:23:30+00:00'></data>
<a class="detailed-status__datetime u-url u-uid" rel="noopener noreferrer" href="https://mstdn.nere9.help/@alice/100000000000000002"><time class='formatted' datetime='2026-10-24T09:23:30Z'>2026年10月24日 09:23</time>
</a>·
<span class='detailed-status__visibility-icon'>
<i title="公開" class="fa fa-globe"></i>
</span>
·
<a class="detailed-status__application" target="_blank" rel="noopener noreferrer" href="https://example.com/app">Some App</a>
·
<a class="modal-button detailed-status__link" href="/interact/100000000000000002?type=reply"><i class="fa fa-reply-all"></i>
<span class='detailed-status__reblogs'>1</span>
</a>·
<a class="modal-button detailed-status__link" href="/interact/100000000000000002?type=reblog"><i class="fa fa-retweet"></i><span class='detailed-status__reblogs'>0</span>
</a>·
<a class="modal-button detailed-status__link" href="/interact/100000000000000002?type=favourite"><i class="fa fa-star"></i><span class='detailed-status__favorites'>8</span>
</a></div>
</div>
</div>
<div class='entry h-cite entry-successor'>
<div class='status status-private'>
<div class='status__info'>
<a class="status__relative-time u-url u-uid" rel="noopener noreferrer" href="https://mstdn.nere9.help/@bob/100000000000000003"><span class='status__visibility-icon'><i title="フォロワー限定" class="fa fa-lock"></i></span><time class='time-ago' datetime='2026-10-24T09:30:00Z'>2026年10月24日 09:30</time>
</a><data class='dt-published' value='2026-10-24T09:30:00+00:00'></data>
<div class='p-author h-card'>
<a class="status__display-name u-url" rel="noopener noreferrer" href="https://mstdn.nere9.help/@bob"><span class='display-name'><bdi><strong class='display-name__html p-name emojify'>Bob</strong></bdi></span></a>
</div>
</div>
<div class='status__content emojify'><div class='e-content'>
<p>A followers-only reply.</p>
</div></div>
<div class='status__action-bar'>
<a class="status__action-bar-button icon-button icon-button--with-counter modal-button" href="/interact/100000000000000003?type=reply"><i class="fa fa-reply-all fa-fw"></i>
<span class='icon-button__counter'>0</span>
</a><a class="status__action-bar-button icon-button modal-button" href="/interact/100000000000000003?type=reblog"><i class="fa fa-lock fa-fw"></i>
</a><a class="status__action-bar-button icon-button modal-button" href="/interact/100000000000000003?type=favourite"><i class="fa fa-star fa-fw"></i>
</a></div>
</div>
</div>
</div>
</div>
</div></div>
</div>
</div>`;

/**
 * The public timeline once its client has drawn the posts, which it does in the
 * compact form of the detailed status markup, with no reply link and no
 * `modal-button` class. A post from another instance links its date to the
 * original while its action links carry the local id.
 */
export const V3_PUBLIC_TIMELINE_PAGE =`${SIGNED_OUT_INITIAL_STATE}
<div class='public-layout'>
<div id='mastodon-timeline'>
<div class="detailed-status detailed-status-public compact"><a href="https://remote.example/@carol" class="detailed-status__display-name"><span class="display-name"><bdi><strong class="display-name__html">Carol</strong></bdi></span></a><div class="status__content" tabindex="0"><div class="status__content__text status__content__text--visible translate"><p>A post from another instance.</p></div></div><div class="detailed-status__meta"><a class="detailed-status__datetime" href="https://remote.example/@carol/200000000000000001" target="_blank" rel="noopener noreferrer"><span>2026年10月24日 11:35</span></a> · <i role="img" class="fa fa-globe" title="公開"></i> · <a href="/interact/100000000000000004?type=reblog" class="detailed-status__link"><i role="img" class="fa fa-retweet"></i><span class="detailed-status__reblogs"><span class="animated-number"><span><span>0</span></span></span></span></a> · <a href="/interact/100000000000000004?type=favourite" class="detailed-status__link"><i role="img" class="fa fa-star"></i><span class="detailed-status__favorites"><span class="animated-number"><span><span>0</span></span></span></span></a></div></div>
</div>
</div>`;
