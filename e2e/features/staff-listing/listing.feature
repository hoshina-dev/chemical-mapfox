Feature: Staff experiment listing
  As lab staff (an admin)
  I want every experiment ticket in one searchable, sortable, filterable table
  So that I can find and open the experiment I need to work on

  Background:
    Given the following users exist:
      | name         | email              | password    | role  |
      | Avery Admin  | admin@example.com  | password123 | admin |
      | Casey Client | client@example.com | password123 | user  |
      | Beck Buyer   | beck@example.com   | password123 | user  |
    And the following experiment tickets exist:
      | id          | name          | status        | requester          | createdAt            | updatedAt            |
      | ctx-alpha   | Acetone GC-MS | requested     | client@example.com | 2025-01-01T09:00:00Z | 2025-01-02T09:00:00Z |
      | ctx-bravo   | Benzene NMR   | experimenting | beck@example.com   | 2025-01-03T09:00:00Z | 2025-01-04T09:00:00Z |
      | ctx-charlie | Caffeine HPLC | closed        | client@example.com | 2025-01-05T09:00:00Z | 2025-01-06T09:00:00Z |
    And I am signed in as "admin@example.com" with password "password123"
    And I visit "/admin"

  Scenario: Admin sees every experiment with requester emails joined from custapi
    Then I should see 3 experiments in the listing
    And I should see the experiment "Acetone GC-MS"
    And I should see the experiment "Benzene NMR"
    And I should see the experiment "Caffeine HPLC"
    And the experiment "Acetone GC-MS" should show requester "client@example.com"
    And the experiment "Benzene NMR" should show requester "beck@example.com"

  Scenario Outline: Search narrows the listing by name, requester, or context id
    When I search the experiments for "<query>"
    Then I should see the experiment "<match>"
    And I should see 1 experiments in the listing

    Examples:
      | query              | match         |
      | Benzene            | Benzene NMR   |
      | beck@example.com   | Benzene NMR   |
      | ctx-charlie        | Caffeine HPLC |

  Scenario: Filtering by status narrows the rows to that status
    When I filter experiments by status "In progress"
    Then I should see 1 experiments in the listing
    And I should see the experiment "Benzene NMR"
    And I should not see the experiment "Acetone GC-MS"
    And I should not see the experiment "Caffeine HPLC"

  Scenario: Sorting by the experiment column reorders the rows
    Then the experiments should appear in this order:
      | experiment    |
      | Caffeine HPLC |
      | Benzene NMR   |
      | Acetone GC-MS |
    When I sort the experiments by "Experiment"
    Then the experiments should appear in this order:
      | experiment    |
      | Acetone GC-MS |
      | Benzene NMR   |
      | Caffeine HPLC |
