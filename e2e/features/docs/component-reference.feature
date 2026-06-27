Feature: Form-author documentation
  The staff component reference under /internal/docs lists every form
  question type and, on each type page, shows a live preview alongside the
  generated schema fields. The whole area is admin-only.

  Background:
    Given the following users exist:
      | name         | email              | password    | role  |
      | Casey Client | client@example.com | password123 | user  |
      | Avery Admin  | admin@example.com  | password123 | admin |

  Scenario: An admin sees the component reference index listing the question types
    Given I am signed in as "admin@example.com" with password "password123"
    When I visit "/internal/docs"
    Then I should see the "Component reference" heading
    And the component reference should list "Short text"
    And the component reference should list "Number"
    And the component reference should list "Color"
    And the component reference should list "Repeatable group"

  Scenario: A question-type page shows a live preview and the generated schema fields
    Given I am signed in as "admin@example.com" with password "password123"
    When I visit "/internal/docs/string"
    Then I should see the "Short text" heading
    And I should see the "Live preview" heading
    And the live preview should render the field labelled "Your name"
    And I should see the "Schema fields" heading
    And the schema fields should document the "label" field

  Scenario: A client cannot reach the form-author documentation
    Given I am signed in as "client@example.com" with password "password123"
    When I visit "/internal/docs"
    Then I should be on the "my experiments" page
