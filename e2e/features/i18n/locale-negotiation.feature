Feature: Locale negotiation from browser language
  A visitor who has never chosen a language gets the UI in whatever locale
  their browser asks for (Accept-Language), set once via the NEXT_LOCALE
  cookie by proxy.ts, falling back to English when nothing matches.

  Scenario: A supported browser language is honored on first visit
    Given I am not signed in
    And my browser prefers the language "pl-PL,en;q=0.5"
    When I visit "/"
    Then the UI language should be "pl"
    And the preferred locale cookie should be "pl"

  Scenario: An unsupported browser language falls back to English
    Given I am not signed in
    And my browser prefers the language "de-DE,fr;q=0.9"
    When I visit "/"
    Then the UI language should be "en"
    And the preferred locale cookie should be "en"
