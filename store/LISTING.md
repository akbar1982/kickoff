# Kickoff: store listing kit

Copy-paste answers for App Store Connect and Google Play Console. Everything here matches what the app
actually does as of October 2026. If you add analytics, crash reporting, ads or new data, update the
privacy sections **and** `site/privacy.html`.

- Bundle ID / package: `com.akbar.soccer`
- Seller / developer: Akbar Yuldoshev (individual)
- Support email: akbar.yuldoshev.professional@gmail.com

| URL | |
|---|---|
| Marketing | https://vermillion-puppy-de60d4.netlify.app |
| Support | https://vermillion-puppy-de60d4.netlify.app/support.html |
| Privacy Policy | https://vermillion-puppy-de60d4.netlify.app/privacy.html |
| Terms of Use (EULA) | https://vermillion-puppy-de60d4.netlify.app/terms.html |
| Account deletion (Google) | https://vermillion-puppy-de60d4.netlify.app/delete-account.html |

---

## 1. Name and short text

**App name** (max 30): `Kickoff: Pickup Soccer`
"Kickoff" alone is almost certainly taken on both stores. Keep the home-screen name "Kickoff".

**Apple subtitle** (max 30): `Find and organize local games`

**Google short description** (max 80): `Find pickup soccer near you, join groups, chat with players, and pay for your spot.`

**Apple promotional text** (max 170, editable anytime without review):
`Find a game tonight. Kickoff shows pickup soccer near you, holds your spot, and tells you the moment enough players are in.`

**Apple keywords** (max 100, comma-separated, no spaces):
`soccer,football,pickup,futsal,league,team,game,match,organizer,players,rsvp,field,park,sports,local`

**Category:** Sports (Apple secondary: Social Networking). Google: Sports.

## 2. Full description (Apple max 4000, Google max 4000)

```
Kickoff makes pickup soccer easy: find a game nearby, grab a spot, and play.

FIND GAMES NEAR YOU
• See upcoming games on a list or a map, sorted by distance
• Every game shows how many players are in and how many more are needed to confirm it
• Join the waitlist when a game is full. You're moved in automatically when a spot opens

ORGANIZE YOUR OWN
• Post a game in seconds: venue, time, player limits and price
• Run polls so players can vote on the time or place
• Free or paid games. Collect payments in the app with card, Apple Pay or Google Pay, or let players pay you directly and mark them paid

GROUPS
• Start a group for your regular crew. Anyone can create one
• Invite players or approve join requests
• Post games for your group only, or open them to everyone

CHAT
• Community chat for everyone, plus a chat for every group and every game
• Report messages and block people anytime

PAYMENTS YOU CAN TRUST
• In-app payments are processed by Stripe and go straight to the organizer's own account
• Your spot is held for 15 minutes while you pay, so no one can take it

Kickoff is for players 18 and older. Games are organized by users, not by Kickoff. Play safe and have fun.
```

## 3. Screenshots

- **Apple:** 6.9" iPhone, **1320 x 2868**. Use the *iPhone 17 Pro Max* simulator (`xcrun simctl io booted screenshot shot.png`). 3 to 10 images.
- **Google:** at least 2 phone screenshots (any 9:16, e.g. the emulator's 1080 x 2400), a **512 x 512** app icon, and a **1024 x 500** feature graphic.

Suggested set, in this order: Games list · Game details with player meter · Map · Group page · Game chat · Checkout.
Use realistic demo data (real-looking names and venues, a few games), not "test".

## 4. Apple: App Privacy ("nutrition label")

**Do you or your third-party partners use data for tracking?** No.

| Data type | Collected | Linked to user | Tracking | Purposes |
|---|---|---|---|---|
| Contact Info: **Name** | Yes | Yes | No | App Functionality |
| Contact Info: **Email Address** | Yes | Yes | No | App Functionality |
| Location: **Precise Location** | Yes | **No** | No | App Functionality (sent to Google Places to suggest nearby venues; not stored) |
| User Content: **Other User Content** (chat messages, games, groups, polls) | Yes | Yes | No | App Functionality |
| Identifiers: **User ID** | Yes | Yes | No | App Functionality |
| Financial Info: **Payment Info** | Yes | Yes | No | App Functionality, Fraud Prevention (card entry in the Stripe payment sheet) |
| Purchases: **Purchase History** | Yes | Yes | No | App Functionality |

Not collected: Health, Fitness, Contacts, Photos/Videos, Audio, Browsing/Search History, Sensitive Info,
Usage Data, Diagnostics, Advertising Data.

Check Stripe's current App Store privacy guidance before submitting
(search "Stripe iOS SDK App Store privacy details"). If it lists more (for example Device ID or
other diagnostic data for fraud prevention), add those rows.

## 5. Google Play: Data safety

- Does your app collect or share user data? **Yes**
- Is all user data encrypted in transit? **Yes**
- Do you provide a way for users to request deletion? **Yes**, in the app (Me → Delete account) and at the account deletion URL above.

"Shared" in Google's form means passing data to third parties *other than* service providers. Supabase,
Stripe and Google Places act as service providers, so nothing is "shared".

| Category: data type | Collected | Shared | Ephemeral | Required | Purposes |
|---|---|---|---|---|---|
| Location: Approximate location | Yes | No | Yes | Optional | App functionality |
| Location: Precise location | Yes | No | Yes | Optional | App functionality |
| Personal info: Name | Yes | No | No | Required | App functionality, Account management |
| Personal info: Email address | Yes | No | No | Required | App functionality, Account management |
| Personal info: User IDs | Yes | No | No | Required | App functionality, Account management |
| Financial info: User payment info | Yes | No | No | Optional | App functionality, Fraud prevention |
| Financial info: Purchase history | Yes | No | No | Optional | App functionality |
| Messages: Other in-app messages | Yes | No | No | Optional | App functionality |
| App activity: Other user-generated content | Yes | No | No | Optional | App functionality |

## 6. Ratings and other questionnaires

**Apple age rating:**
- All violence, mature, gambling, horror, medical, alcohol/drugs and sexual content: **None**
- **User-Generated Content: Yes**
- **Messaging and Chat: Yes**
- Unrestricted web access: No
- Advertising: No

Accept the rating Apple calculates. The Terms already say 18+.

**Google content rating (IARC):**
- Category: Social / Communication, or "All other app types" if offered
- Users can interact or exchange content: **Yes**
- Shares location with other users: **No**
- Purchases of digital goods: **No**
- All violence, sexual, language, drugs and gambling questions: **No**

**Google, other App content forms:**
- Target audience: **18 and over**
- Contains ads: **No**
- News app: No
- Government app: No
- Health: none
- Financial features: **None of the listed features.** Payments go to organizers through Stripe for in-person games.
- Account deletion URL: see the table at the top

## 7. App Review notes and demo account

Create a dedicated reviewer account before submitting, e.g. `review@<your email domain>` with a strong password:

1. Make it a member of a group.
2. Add a few upcoming **free** games (one group-only, one open).
3. Have a few chat messages in the community chat.

Don't make it an admin.

**Notes for Apple (App Review Information → Notes):**
```
Kickoff helps people organize in-person pickup soccer games.

Demo account: <email> / <password>

• Payments: paid games charge for a spot at a real-world, in-person sports game, so they use Stripe
  (guideline 3.1.3(e), goods and services consumed outside the app). Money goes to the organizer's own
  Stripe account. The demo account has free games you can join without paying.
• Report / block: press and hold any message from another user in a chat (Chat tab → Community).
  Reports are reviewed by our admins within 24 hours.
• Account deletion: Me tab → Delete account.
• Location is optional and only used to show nearby games and suggest venues.
• Sign in with Apple is offered alongside Google and email.
```

Google's "App access" form: choose **All or some functionality is restricted** and give the same demo login.
