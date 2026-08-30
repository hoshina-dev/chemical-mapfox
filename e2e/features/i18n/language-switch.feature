@site-default-locale
Feature: Language switching
  Visitors can switch the UI between English and Polish. The choice is stored
  in the NEXT_LOCALE cookie so it survives a reload. Native language names in
  the switcher stay fixed (English / Polski); only chrome copy and the
  switcher's accessible name change with the locale. Without a cookie, the
  site is Polish regardless of the browser language.

  # This feature is the sole e2e exception to the English-only assertion
  # convention — it must verify localized copy to prove the switch works.

  Scenario: An unauthenticated visitor sees Polish by default
    Given I am not signed in
    When I visit "/"
    Then I should be on the landing page
    And the UI language should be "pl"
    And I should see the landing hero in "pl"
    And the preferred locale cookie should be "pl"

  Scenario: An unauthenticated visitor switches language on the landing page
    Given I am not signed in
    When I visit "/"
    Then I should be on the landing page
    And the UI language should be "pl"
    And I should see the landing hero in "pl"
    When I switch the UI language to "en"
    Then the UI language should be "en"
    And I should see the landing hero in "en"
    And the preferred locale cookie should be "en"
    When I reload the page
    Then the UI language should be "en"
    And I should see the landing hero in "en"
    When I switch the UI language to "pl"
    Then the UI language should be "pl"
    And I should see the landing hero in "pl"
    And the preferred locale cookie should be "pl"

  Scenario: Language preference carries from the landing page to sign-in
    Given I am not signed in
    When I visit "/"
    Then I should be on the landing page
    And the UI language should be "pl"
    When I click the "Zaloguj się" link
    Then I should be on the login page
    And the UI language should be "pl"
    And I should see the sign-in form in "pl"
