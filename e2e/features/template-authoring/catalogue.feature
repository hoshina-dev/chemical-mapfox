Feature: Staff catalogue visibility and ordering
  Staff manage the public list independently of online request eligibility.

  Background:
    Given the following users exist:
      | name         | email              | password    | role  |
      | Avery Admin  | admin@example.com  | password123 | admin |
      | Casey Client | client@example.com | password123 | user  |
    And the sample "Coal" has an experiment template "Ready test"
    And the sample "Coal" has an experiment template "Other ready test"
    And the sample "Coal" has a public experiment "Listed test" without a PDF report
    And the sample "Water" has an experiment template "Water test"
    And I am signed in as "admin@example.com" with password "password123"

  Scenario: Visibility is saved independently of PDF readiness
    When I visit the catalogue settings for "Coal"
    And I hide "Ready test" from the landing page
    And I reload the catalogue settings
    Then "Ready test" should be hidden in catalogue settings
    When I visit "/"
    And I expand the "Coal" specimen in the laboratory offer
    Then the public test "Listed test" should offer contact instead of an online request
    And the public test "Ready test" should not be listed
    Given I am not signed in
    And I am signed in as "client@example.com" with password "password123"
    And I visit "/experiment/request/listing"
    And I open the client catalogue group "Coal"
    Then I should see "Ready test"
    And client test "Listed test" should not be listed

  Scenario: Dragged order persists and is used in both catalogues
    When I visit "/internal/experiment/onboarding"
    And I drag catalogue item "Water" before "Coal"
    And I reload the catalogue settings
    Then catalogue item "Water" should appear at place 1
    When I visit the catalogue settings for "Coal"
    And I move "Ready test" down using the keyboard drag handle
    And I reload the catalogue settings
    Then catalogue item "Other ready test" should appear at place 1
    When I visit "/"
    Then public specimen "Water" should appear before "Coal"
    When I expand the "Coal" specimen in the laboratory offer
    Then public test "Other ready test" should appear before "Ready test"
    Given I am not signed in
    And I am signed in as "client@example.com" with password "password123"
    And I visit "/experiment/request/listing"
    And I open the client catalogue group "Coal"
    Then client test "Other ready test" should appear before "Ready test"

  Scenario: A keyboard drag changes the order without opening the template
    When I visit the catalogue settings for "Coal"
    And I move "Ready test" down using the keyboard drag handle
    Then catalogue item "Ready test" should appear at place 2
    When I reload the catalogue settings
    Then catalogue item "Ready test" should appear at place 2

  Scenario: A pointer drag reorders specimen cards
    When I visit "/internal/experiment/onboarding"
    And I drag catalogue item "Water" before "Coal"
    Then catalogue item "Water" should appear at place 1
    When I reload the catalogue settings
    Then catalogue item "Water" should appear at place 1

  Scenario: Cancelled and unchanged drags do not save
    When I visit the catalogue settings for "Coal"
    And I cancel and leave unchanged the drag of "Ready test"
    Then catalogue item "Ready test" should appear at place 1
    When I reload the catalogue settings
    Then catalogue item "Ready test" should appear at place 1

  Scenario: Failed writes restore the previous visibility
    When I visit the catalogue settings for "Coal"
    Given the next catalogue write will fail
    When I try to hide "Ready test" from the landing page
    Then I should see "Could not save catalogue settings. Refresh and try again."
    And "Ready test" should be visible in catalogue settings

  Scenario: Hiding a specimen keeps its experiment settings intact
    When I visit "/internal/experiment/onboarding"
    And I hide "Coal" from the landing page
    When I visit "/"
    Then public specimen "Coal" should not be listed
    When I visit the catalogue settings for "Coal"
    Then "Ready test" should be visible in catalogue settings

  Scenario: New specimens start hidden
    When I visit "/internal/experiment/onboarding"
    And I register a sample named "Soil"
    And I visit "/internal/experiment/onboarding"
    Then "Soil" should be hidden in catalogue settings

  Scenario: Touch dragging works on narrow staff screens
    When I visit the catalogue settings for "Coal"
    And I move "Ready test" down using a touch drag
    Then catalogue item "Ready test" should appear at place 2
    And the catalogue controls should fit the mobile viewport

  Scenario: A listed test without a PDF cannot be requested directly
    Given I am not signed in
    And I am signed in as "client@example.com" with password "password123"
    When I visit the request form for catalogue test "Listed test"
    Then I should see "Report layout not set up"
    And the catalogue request submit button should be disabled
