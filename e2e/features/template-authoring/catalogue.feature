Feature: Staff catalogue visibility and ordering
  Staff choose which specimens and tests the landing page and the client
  request catalogue offer, and in which order. Hidden ones cannot be requested.

  Background:
    Given the following users exist:
      | name         | email              | password    | role  |
      | Avery Admin  | admin@example.com  | password123 | admin |
      | Casey Client | client@example.com | password123 | user  |
    And the sample "Coal" has an experiment template "Ready test"
    And the sample "Coal" has an experiment template "Other ready test"
    And the sample "Coal" has an experiment template "Listed test"
    And the sample "Water" has an experiment template "Water test"
    And I am signed in as "admin@example.com" with password "password123"

  Scenario: A hidden test leaves both catalogues
    When I visit the catalogue settings for "Coal"
    And I hide "Ready test" from clients
    And I reload the catalogue settings
    Then "Ready test" should be hidden in catalogue settings
    When I visit "/"
    And I expand the "Coal" specimen in the laboratory offer
    Then the public test "Listed test" should offer an online request
    And the public test "Ready test" should not be listed
    Given I am not signed in
    And I am signed in as "client@example.com" with password "password123"
    And I visit "/experiment/request/listing"
    And I open the client catalogue group "Coal"
    Then I should see "Listed test"
    And client test "Ready test" should not be listed

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
    When I try to hide "Ready test" from clients
    Then I should see "Could not save catalogue settings. Refresh and try again."
    And "Ready test" should be visible in catalogue settings

  Scenario: Hiding a specimen keeps its experiment settings intact
    When I visit "/internal/experiment/onboarding"
    And I hide "Coal" from clients
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

  Scenario: A specimen without a report form is flagged for staff
    Given the sample "Water" has no report form
    When I visit "/internal/experiment/onboarding"
    Then catalogue item "Water" should be flagged as missing its report form
    And catalogue item "Coal" should appear at place 1
