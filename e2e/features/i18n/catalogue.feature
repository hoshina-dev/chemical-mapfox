Feature: Catalogue drag announcements follow the selected language
  Scenario: Switching to Polish updates keyboard drag instructions and feedback
    Given the following users exist:
      | name        | email             | password    | role  |
      | Avery Admin | admin@example.com | password123 | admin |
    And the sample "Coal" has an experiment template "Ready test"
    And the sample "Coal" has an experiment template "Other ready test"
    And I am signed in as "admin@example.com" with password "password123"
    When I visit the catalogue settings for "Coal"
    And I switch the UI language to "pl"
    And I reorder catalogue test "Ready test" with Polish keyboard announcements
    Then the catalogue drag announcement should be "Upuszczono element."
    When I switch the UI language to "en"
    And I move "Other ready test" down using the keyboard drag handle
    Then the catalogue drag announcement should be "Item dropped."
